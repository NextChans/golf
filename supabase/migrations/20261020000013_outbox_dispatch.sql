-- Googolf M6: 알림 outbox 발송(N-01, N-02)
-- 발송기(Edge Function notify-dispatcher)가 1분마다 호출되어 claim → 발송 → 성공/실패 기록을 한다.
-- - claim: FOR UPDATE SKIP LOCKED + lease(locked_at). 동시에 돌아도 같은 행을 두 번 잡지 않는다
-- - lease 만료(5분): 발송기가 죽어 'sending'에 남은 행은 다음 claim에서 다시 잡는다(재발송 가능성은 provider 멱등키로 줄인다)
-- - 실패: 지수 백오프(1, 2, 4, 8분), 5회째 실패하면 dead + 운영자 알림(같은 트랜잭션)
-- 발송기는 service_role로만 호출한다(고객·운영자 세션은 실행 불가).

create extension if not exists pg_net with schema extensions;

-- 최대 시도 횟수와 lease는 한곳에서 정한다
create or replace function app.outbox_max_attempts() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;
create or replace function app.outbox_lease() returns interval
language sql immutable set search_path = '' as $$ select interval '5 minutes' $$;

-- ── claim: 보낼 차례인 행을 잠그고 sending으로 바꾼다 ─────────
-- 고객 알림은 받는 사람 연락처를 함께 돌려준다(발송기가 profiles를 따로 읽지 않게)
create or replace function public.claim_notifications(p_limit integer default 20)
returns table (
  id bigint,
  event_type text,
  recipient_kind text,
  recipient_phone text,
  channel public.notify_channel,
  template_code text,
  payload jsonb,
  dedupe_key text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_limit, 0) not between 1 and 100 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'limit 1..100';
  end if;
  return query
    with due as (
      select o.id from public.notification_outbox o
       where (o.status in ('pending', 'failed') and o.next_attempt_at <= now())
          or (o.status = 'sending' and o.locked_at < now() - app.outbox_lease())
       order by o.next_attempt_at, o.id
       for update skip locked
       limit p_limit
    ), claimed as (
      update public.notification_outbox o
         set status = 'sending', locked_at = now(), attempts = o.attempts + 1
        from due where o.id = due.id
      returning o.*
    )
    select c.id, c.event_type, c.recipient_kind, p.phone, c.channel, c.template_code, c.payload, c.dedupe_key, c.attempts
      from claimed c
      left join public.profiles p on p.id = c.recipient_user_id
     order by c.id;
end;
$$;

-- ── 성공 기록 ─────────────────────────────────────────────
-- p_channel: 실제로 보낸 채널(알림톡 실패 후 SMS로 대체 발송했으면 sms)
create or replace function public.complete_notification(
  p_id bigint, p_channel public.notify_channel, p_provider_message_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
     set status = 'sent', sent_at = now(), locked_at = null, last_error = null,
         channel = coalesce(p_channel, channel), provider_message_id = left(p_provider_message_id, 200)
   where id = p_id and status = 'sending';
  if not found then
    -- lease가 만료되어 다른 발송기가 다시 잡았거나 이미 처리됨: 덮어쓰지 않는다
    raise exception 'invalid_state' using errcode = 'GB409', detail = 'notification is not sending';
  end if;
end;
$$;

-- ── 실패 기록: 백오프 후 재시도, 한도 초과 시 dead + 운영자 알림 ──
create or replace function public.fail_notification(p_id bigint, p_error text) returns public.outbox_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_outbox;
begin
  select * into v_row from public.notification_outbox where id = p_id for update;
  if not found or v_row.status <> 'sending' then
    raise exception 'invalid_state' using errcode = 'GB409', detail = 'notification is not sending';
  end if;

  if v_row.attempts >= app.outbox_max_attempts() then
    update public.notification_outbox
       set status = 'dead', locked_at = null, last_error = left(p_error, 1000)
     where id = p_id;
    -- 운영자 알림 자체가 dead가 되면 다시 알리지 않는다(무한 연쇄 방지)
    if v_row.template_code <> 'ADMIN_NOTIFICATION_DEAD' then
      perform app.enqueue_notification('notification.dead', 'admins', null, 'ADMIN_NOTIFICATION_DEAD',
        jsonb_build_object('outbox_id', v_row.id, 'template_code', v_row.template_code,
                           'event_type', v_row.event_type, 'attempts', v_row.attempts,
                           'last_error', left(p_error, 300)),
        format('outbox:%s:dead', v_row.id));
    end if;
    return 'dead';
  end if;

  update public.notification_outbox
     set status = 'failed', locked_at = null, last_error = left(p_error, 1000),
         next_attempt_at = now() + make_interval(mins => power(2, v_row.attempts - 1)::integer)
   where id = p_id;
  return 'failed';
end;
$$;

-- ── 운영자 화면용 재시도(dead → pending, 감사 로그) ──────────
create or replace function public.retry_notification(p_id bigint) returns public.notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.notification_outbox;
  v_after public.notification_outbox;
begin
  perform app.require_admin();
  select * into v_before from public.notification_outbox where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_before.status <> 'dead' then
    perform app.invalid_state(v_before.status::text, 'retry');
  end if;
  update public.notification_outbox
     set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
   where id = p_id returning * into v_after;
  perform app.write_audit('notification', p_id::text, 'retry',
    jsonb_build_object('status', v_before.status, 'attempts', v_before.attempts, 'last_error', v_before.last_error),
    jsonb_build_object('status', v_after.status));
  return v_after;
end;
$$;

-- ── 1분 주기 호출: Vault에 URL·비밀값이 있을 때만 발송기를 부른다 ──
-- 운영: vault.create_secret('<함수 URL>', 'notify_dispatch_url'), vault.create_secret('<비밀값>', 'notify_dispatch_secret')
-- 로컬: 비워 두면 아무것도 하지 않는다(테스트는 함수를 직접 부른다)
create or replace function app.invoke_notify_dispatcher() returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_dispatch_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  -- 보낼 것이 없으면 호출하지 않는다(무료 한도 절약)
  if not exists (
    select 1 from public.notification_outbox
     where (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'sending' and locked_at < now() - app.outbox_lease())
  ) then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

select cron.schedule('notify-dispatch', '* * * * *', $$select app.invoke_notify_dispatcher()$$);

-- sending lease 인덱스(만료 재claim 탐색)
create index if not exists notification_outbox_sending_idx on public.notification_outbox (locked_at)
  where status = 'sending';

revoke execute on function
  public.claim_notifications(integer),
  public.complete_notification(bigint, public.notify_channel, text),
  public.fail_notification(bigint, text),
  public.retry_notification(bigint)
from public, anon, authenticated, service_role;
grant execute on function
  public.claim_notifications(integer),
  public.complete_notification(bigint, public.notify_channel, text),
  public.fail_notification(bigint, text)
to service_role;
grant execute on function public.retry_notification(bigint) to authenticated;
revoke execute on function app.invoke_notify_dispatcher() from public;

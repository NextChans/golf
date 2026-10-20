-- Googolf M1: 내부 헬퍼(app 스키마)
-- 에러 코드 규약(SQLSTATE, message는 기계용 코드):
--   GB401 unauthenticated     GB403 forbidden / onboarding_required / append-only
--   GB404 not_found           GB409 version_conflict / invalid_state / listing_unavailable / idempotency_key_reused
--   GB422 invalid_input       GB429 rate_limited
-- lib/domain/errors.ts가 이 코드를 사용자 메시지로 매핑한다.

-- ── 역할 판별: app_metadata.role만 신뢰한다(user_metadata 금지) ──
create or replace function app.jwt_role() returns text
language sql stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'anon'
    when auth.jwt() -> 'app_metadata' ->> 'role' in ('admin', 'owner')
      then auth.jwt() -> 'app_metadata' ->> 'role'
    else 'customer'
  end;
$$;

-- 운영자는 MFA(aal2)를 통과한 세션에서만 운영자로 인정한다.
create or replace function app.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select app.jwt_role() in ('admin', 'owner')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function app.is_owner() returns boolean
language sql stable
set search_path = ''
as $$
  select app.jwt_role() = 'owner'
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function app.require_user() returns uuid
language plpgsql stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = 'GB401';
  end if;
  return auth.uid();
end;
$$;

-- 온보딩(휴대폰 인증·약관 동의)을 마친 고객만 통과
create or replace function app.require_customer() returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
begin
  if app.jwt_role() <> 'customer' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'customer only';
  end if;
  perform 1 from public.profiles
   where id = v_uid and onboarded_at is not null and deleted_at is null;
  if not found then
    raise exception 'onboarding_required' using errcode = 'GB403';
  end if;
  return v_uid;
end;
$$;

create or replace function app.require_admin() returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'admin with aal2 required';
  end if;
  return v_uid;
end;
$$;

-- auth.users의 app_metadata 기준 운영자 여부(배정 대상 검증용)
create or replace function app.user_is_admin(p_user_id uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select raw_app_meta_data ->> 'role' in ('admin', 'owner') from auth.users where id = p_user_id),
    false
  );
$$;

-- ── 요청 메타데이터(IP, UA) ─────────────────────────────
-- Server Action이 x-client-ip / x-client-ua로 원 사용자 값을 전달한다.
-- 없으면 PostgREST가 받은 x-forwarded-for를 쓴다. 클라이언트가 위조할 수 있는 값이므로 참고용이다.
create or replace function app.request_header(p_name text) returns text
language sql stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::jsonb ->> p_name;
$$;

create or replace function app.client_ip() returns inet
language plpgsql stable
set search_path = ''
as $$
declare
  v_raw text := coalesce(
    app.request_header('x-client-ip'),
    split_part(app.request_header('x-forwarded-for'), ',', 1)
  );
begin
  return nullif(trim(v_raw), '')::inet;
exception when others then
  return null;
end;
$$;

-- ── 감사 로그 ───────────────────────────────────────────
create or replace function app.write_audit(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_before jsonb,
  p_after jsonb
) returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, actor_role, entity_type, entity_id, action, before, after, ip, user_agent)
  values (
    auth.uid(),
    case when auth.uid() is null then 'system' else app.jwt_role() end,
    p_entity_type, p_entity_id, p_action, p_before, p_after,
    app.client_ip(),
    left(coalesce(app.request_header('x-client-ua'), app.request_header('user-agent')), 500)
  );
end;
$$;

-- ── 알림 적재(같은 트랜잭션). dedupe_key가 같으면 무시 ───────
create or replace function app.enqueue_notification(
  p_event_type text,
  p_recipient_kind text,
  p_recipient_user_id uuid,
  p_template_code text,
  p_payload jsonb,
  p_dedupe_key text
) returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.notification_outbox
    (event_type, recipient_kind, recipient_user_id, channel, template_code, payload, dedupe_key)
  values (
    p_event_type, p_recipient_kind, p_recipient_user_id,
    case when p_recipient_kind = 'admins' then 'slack'::public.notify_channel
         else 'alimtalk'::public.notify_channel end,
    p_template_code, coalesce(p_payload, '{}'::jsonb), p_dedupe_key
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

-- ── 멱등키 ──────────────────────────────────────────────
-- 반환값이 null이면 처음 들어온 요청이므로 진행한다. null이 아니면 이전 결과를 그대로 돌려준다.
-- 같은 키로 동시에 들어오면 unique 인덱스에서 뒤 요청이 대기하고, 앞 요청이 커밋한 뒤 그 결과를 받는다.
create or replace function app.idempotency_begin(p_key uuid, p_action text, p_request_hash text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
  v_row public.idempotency_keys;
begin
  if p_key is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'idempotency key required';
  end if;

  insert into public.idempotency_keys (user_id, key, action, request_hash)
  values (v_uid, p_key, p_action, p_request_hash)
  on conflict (user_id, key) do nothing;
  if found then
    return null;
  end if;

  select * into v_row from public.idempotency_keys where user_id = v_uid and key = p_key;
  if v_row.action <> p_action or v_row.request_hash <> p_request_hash then
    raise exception 'idempotency_key_reused' using errcode = 'GB409';
  end if;
  return v_row.result;
end;
$$;

create or replace function app.idempotency_finish(p_key uuid, p_result jsonb) returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.idempotency_keys set result = p_result
   where user_id = auth.uid() and key = p_key;
end;
$$;

-- ── rate limit: 사용자별 10분당 5건 ───────────────────────
create or replace function app.enforce_rate_limit(p_kind text) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
  v_count integer;
begin
  -- 같은 사용자의 동시 요청을 직렬화해 카운트 경쟁을 막는다.
  perform pg_advisory_xact_lock(hashtextextended('rate:' || p_kind || ':' || v_uid::text, 0));

  if p_kind = 'booking' then
    select count(*) into v_count from public.booking_requests
     where user_id = v_uid and created_at > now() - interval '10 minutes';
  elsif p_kind = 'deal' then
    select count(*) into v_count from public.membership_deals
     where user_id = v_uid and created_at > now() - interval '10 minutes';
  else
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown rate limit kind';
  end if;

  if v_count >= 5 then
    raise exception 'rate_limited' using errcode = 'GB429', detail = '10분당 5건까지 접수할 수 있습니다';
  end if;
end;
$$;

-- ── SLA: 평일 09:00~18:00 KST 영업시간 기준 N분 ────────────
create or replace function app.business_sla_due(p_from timestamptz, p_minutes integer default 30) returns timestamptz
language plpgsql stable
set search_path = ''
as $$
declare
  v_local timestamp := p_from at time zone 'Asia/Seoul';
  v_remaining interval := make_interval(mins => p_minutes);
  v_day_end timestamp;
  v_guard integer := 0;
begin
  loop
    v_guard := v_guard + 1;
    if v_guard > 400 then
      raise exception 'sla calculation did not converge' using errcode = 'GB422';
    end if;
    if extract(isodow from v_local) in (6, 7)
       or exists (select 1 from public.business_holidays where holiday = v_local::date) then
      v_local := v_local::date + interval '1 day' + time '09:00';
      continue;
    end if;
    if v_local::time < time '09:00' then
      v_local := v_local::date + time '09:00';
    end if;
    v_day_end := v_local::date + time '18:00';
    if v_local >= v_day_end then
      v_local := v_local::date + interval '1 day' + time '09:00';
      continue;
    end if;
    if v_local + v_remaining <= v_day_end then
      return (v_local + v_remaining) at time zone 'Asia/Seoul';
    end if;
    v_remaining := v_remaining - (v_day_end - v_local);
    v_local := v_local::date + interval '1 day' + time '09:00';
  end loop;
end;
$$;

create or replace function app.today_kst() returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

-- Googolf D-88: 부킹 DB 제거(테이블·상태 함수·배치·크론·enum)
--
-- 목적: 부킹 서비스는 D-87로 앱 화면·코드가 제거되어 배포됐고, 오너(2026-10-24)가 "아무도 사용하지 않는다,
--       부킹 DB도 제거하라"고 승인했다. 운영 DB에서 부킹 전용 객체를 지운다.
-- ⚠ 되돌릴 수 없다: booking_requests·booking_proposals·booking_events의 행과 부킹 대상 통화 메모,
--   보내지 않은 부킹 알림(outbox pending/failed/sending)이 삭제된다. 되살리려면 백업에서 복구해야 한다.
--   (부킹 감사 기록은 audit_logs에 그대로 남는다. audit_logs는 append-only라 건드리지 않는다)
-- 반영 순서(D-50): 앱이 부킹 UI 없이 이미 배포된 뒤(PR #13, D-87)에 DB를 반영한다. 이 PR의 앱 변경은
--   부킹 객체를 쓰지 않으므로 DB 반영 전후 어느 쪽에서도 동작한다. 발송기(Edge Function)는 모르는
--   템플릿을 기본 문구로 보내므로 functions-deploy 순서와 무관하다.
--
-- 순서: 크론 해제 → 데이터 정리(outbox·메모·멱등키) → 공용 함수에서 부킹 분기 제거 → 부킹 함수 → 테이블 → 타입
-- cascade는 쓰지 않는다. 부킹 객체에 예상하지 못한 의존(뷰·다른 함수 시그니처 등)이 있으면 전체가 실패하고
-- 롤백된다(회원권·모임 객체가 함께 지워지는 일이 없게). 정책·트리거·인덱스·FK는 테이블과 함께 지워진다.
-- 유지: region(golf_courses), app.invalid_state·app.today_kst·app.business_sla_due·business_holidays(범용),
--   app.require_contact_on_insert(회원권 상담 트리거), audit_logs 전부, 알림 sent/dead 이력.

-- ── 1. 크론 해제(없어도 오류 없음) ───────────────────────────
do $$
declare
  v_job record;
begin
  for v_job in select jobid, jobname from cron.job where jobname in ('expire-proposals', 'mark-sla-breaches') loop
    perform cron.unschedule(v_job.jobid);
    raise notice 'cron unscheduled: %', v_job.jobname;
  end loop;
end;
$$;

-- ── 2. 삭제 전 행 수 기록 + 데이터 정리 ─────────────────────────
do $$
declare
  v_booking_templates constant text[] := array[
    'BOOKING_IN_REVIEW', 'BOOKING_PROPOSED', 'BOOKING_CONFIRMED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED',
    'BOOKING_PROPOSAL_EXPIRED', 'ADMIN_BOOKING_REQUESTED', 'ADMIN_BOOKING_CONFIRMED', 'ADMIN_BOOKING_CANCELLED',
    'ADMIN_PROPOSAL_DECLINED', 'ADMIN_PROPOSAL_EXPIRED', 'ADMIN_SLA_BREACHED'
  ];
  v_requests bigint := 0;
  v_proposals bigint := 0;
  v_events bigint := 0;
  v_note_ids bigint[];
  v_outbox_ids bigint[];
  v_outbox_kept bigint;
  v_idem bigint;
begin
  -- 진행 중인 쓰기가 끝난 뒤의 행 수를 센다(이후 drop까지 같은 트랜잭션에서 잠금 유지)
  if to_regclass('public.booking_requests') is not null then
    lock table public.booking_requests, public.booking_proposals, public.booking_events in access exclusive mode;
    select count(*) into v_requests from public.booking_requests;
    select count(*) into v_proposals from public.booking_proposals;
    select count(*) into v_events from public.booking_events;
  end if;
  raise notice 'booking rows before drop: requests=%, proposals=%, events=%', v_requests, v_proposals, v_events;

  -- 부킹 대상 통화 메모: 대상이 사라지므로 삭제(작성 시 audit_logs에 본문이 남아 있다)
  with d as (delete from public.activity_notes where subject_type = 'booking' returning id)
  select coalesce(array_agg(id order by id), '{}') into v_note_ids from d;
  raise notice 'activity_notes(subject=booking) deleted: %', cardinality(v_note_ids);

  -- 아직 보내지 않은 부킹 알림은 삭제(발송기가 링크가 사라진 알림을 보내거나 재시도하지 않게).
  -- dead로 바꾸지 않는다: 직접 update는 운영자 알림을 만들지 않지만, 운영자 화면의 "실패 알림"에 쌓인다.
  -- sent·dead 이력은 남긴다.
  with d as (
    delete from public.notification_outbox
     where status in ('pending', 'failed', 'sending')
       and (event_type like 'booking.%' or template_code = any (v_booking_templates))
    returning id
  )
  select coalesce(array_agg(id order by id), '{}') into v_outbox_ids from d;
  select count(*) into v_outbox_kept from public.notification_outbox
   where event_type like 'booking.%' or template_code = any (v_booking_templates);
  raise notice 'notification_outbox booking rows deleted (pending/failed/sending): %, kept (sent/dead): %',
    cardinality(v_outbox_ids), v_outbox_kept;

  -- 사라지는 함수의 멱등키(24시간 뒤 크론이 지우지만 부킹 행 사본이 들어 있어 함께 정리)
  delete from public.idempotency_keys where action in ('create_booking_request', 'accept_proposal');
  get diagnostics v_idem = row_count;
  raise notice 'idempotency_keys deleted: %', v_idem;

  -- 정리 내역을 감사 로그에 남긴다(행위자 system)
  perform app.write_audit('migration', '20261020000017', 'drop_booking',
    jsonb_build_object(
      'booking_requests', v_requests, 'booking_proposals', v_proposals, 'booking_events', v_events,
      'deleted_activity_note_ids', to_jsonb(v_note_ids), 'deleted_outbox_ids', to_jsonb(v_outbox_ids),
      'kept_outbox_rows', v_outbox_kept, 'deleted_idempotency_keys', v_idem),
    null);
end;
$$;

-- ── 3. 공용 함수에서 부킹 분기 제거(create or replace: 권한·소유자 유지) ──
-- 통화 메모 대상: customer, deal
alter table public.activity_notes drop constraint if exists activity_notes_subject_type_check;
alter table public.activity_notes add constraint activity_notes_subject_type_check
  check (subject_type in ('customer', 'deal'));

create or replace function public.add_activity_note(
  p_customer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_body text
) returns public.activity_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_note public.activity_notes;
begin
  p_body := nullif(trim(p_body), '');
  if p_body is null or char_length(p_body) > 2000 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'body 1..2000';
  end if;
  perform 1 from public.profiles where id = p_customer_id;
  if not found then
    raise exception 'not_found' using errcode = 'GB404', detail = 'customer';
  end if;

  if p_subject_type = 'customer' then
    p_subject_id := null;
  elsif p_subject_type = 'deal' then
    perform 1 from public.membership_deals where id = p_subject_id and user_id = p_customer_id;
    if not found then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'deal does not belong to customer';
    end if;
  else
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown subject_type';
  end if;

  insert into public.activity_notes (customer_id, subject_type, subject_id, body, author_id)
  values (p_customer_id, p_subject_type, p_subject_id, p_body, v_uid)
  returning * into v_note;

  perform app.write_audit('activity_note', v_note.id::text, 'create', null, to_jsonb(v_note));
  return v_note;
end;
$$;

-- 연락처 열람 기록 대상: customer, deal(예전 booking 기록은 audit_logs에 그대로 남는다)
create or replace function public.log_pii_view(p_subject_type text, p_subject_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_key text := p_subject_type || ':' || p_subject_id::text;
begin
  if p_subject_type not in ('customer', 'deal') or p_subject_id is null then
    raise exception 'invalid_input' using errcode = 'GB422';
  end if;
  -- 새로고침마다 쌓이지 않게 같은 운영자·대상은 10분에 1건
  perform pg_advisory_xact_lock(hashtextextended('pii:' || v_uid::text || ':' || v_key, 0));
  if exists (select 1 from public.audit_logs
              where actor_id = v_uid and entity_type = 'pii_view' and entity_id = v_key
                and occurred_at > now() - interval '10 minutes') then
    return;
  end if;
  perform app.write_audit('pii_view', v_key, 'view_contact', null, null);
end;
$$;

-- rate limit: 회원권 상담만 남는다
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

  if p_kind = 'deal' then
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

-- ── 4. 부킹 함수(시그니처 명시, cascade 없음) ───────────────────
drop function if exists public.create_booking_request(uuid, uuid, text, date, public.time_pref, time, time, integer, bigint, text);
drop function if exists public.assign_booking(uuid, uuid, integer);
drop function if exists public.propose_booking(uuid, integer, timestamptz, bigint, integer, text);
drop function if exists public.accept_proposal(uuid, uuid, integer);
drop function if exists public.decline_proposal(uuid, integer, text);
drop function if exists public.reject_booking(uuid, integer, text);
drop function if exists public.cancel_booking(uuid, integer, text);
drop function if exists app.expire_proposals();
drop function if exists app.mark_sla_breaches();
drop function if exists app.lock_booking(uuid, integer);
drop function if exists app.booking_payload(public.booking_requests);
drop function if exists app.booking_event(uuid, public.booking_status, public.booking_status, text);
-- 로컬 전용 pgTAP 헬퍼(운영에는 tests 스키마가 없어 건너뛴다). 로컬 DB에 남아 있으면 테이블 drop을 막는다
drop function if exists tests.new_booking(uuid);

-- ── 5. 테이블(정책·트리거·인덱스·FK·identity 시퀀스 포함) ─────────
drop table if exists public.booking_events, public.booking_proposals, public.booking_requests;

-- ── 6. 타입 ─────────────────────────────────────────────────
drop type if exists public.booking_status;
drop type if exists public.proposal_status;
drop type if exists public.time_pref;

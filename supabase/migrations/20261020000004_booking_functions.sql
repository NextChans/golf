-- Googolf M1: 부킹 상태 함수
-- 모든 상태 전이는 이 파일의 함수로만 일어난다(테이블 DML 권한은 회수되어 있음).
-- 공통 순서: 권한 → 요청 행 FOR UPDATE → version → 현재 상태 → 변경 → 이벤트·감사·outbox
-- 잠금 순서: 항상 booking_requests → booking_proposals (교착 방지)

create or replace function app.lock_booking(p_request_id uuid, p_expected_version integer)
returns public.booking_requests
language plpgsql
set search_path = ''
as $$
declare
  v_req public.booking_requests;
begin
  select * into v_req from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  -- 고객은 본인 요청만. 남의 요청은 존재 여부도 노출하지 않는다.
  if not app.is_admin() and v_req.user_id is distinct from auth.uid() then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if p_expected_version is null or v_req.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'GB409',
      detail = format('expected %s, actual %s', p_expected_version, v_req.version);
  end if;
  return v_req;
end;
$$;

create or replace function app.booking_event(
  p_request_id uuid, p_from public.booking_status, p_to public.booking_status, p_message text
) returns void
language sql
set search_path = ''
as $$
  insert into public.booking_events (request_id, from_status, to_status, message)
  values (p_request_id, p_from, p_to, p_message);
$$;

create or replace function app.booking_payload(p_req public.booking_requests) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'request_id', p_req.id,
    'play_date', p_req.play_date,
    'players', p_req.players,
    'course_name', coalesce((select name from public.golf_courses where id = p_req.golf_course_id), p_req.course_name_free)
  );
$$;

create or replace function app.invalid_state(p_current text, p_action text) returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'invalid_state' using errcode = 'GB409',
    detail = format('%s not allowed from %s', p_action, p_current);
end;
$$;

-- ── 생성: ∅ → requested ───────────────────────────────────
create or replace function public.create_booking_request(
  p_idempotency_key uuid,
  p_golf_course_id uuid,
  p_course_name_free text,
  p_play_date date,
  p_time_pref public.time_pref,
  p_time_from time,
  p_time_to time,
  p_players integer,
  p_budget_per_person bigint,
  p_note text
) returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_hash text;
  v_cached jsonb;
  v_req public.booking_requests;
begin
  v_hash := md5(jsonb_build_object(
    'c', p_golf_course_id, 'cf', p_course_name_free, 'd', p_play_date, 'tp', p_time_pref,
    'tf', p_time_from, 'tt', p_time_to, 'p', p_players, 'b', p_budget_per_person, 'n', p_note
  )::text);
  v_cached := app.idempotency_begin(p_idempotency_key, 'create_booking_request', v_hash);
  if v_cached is not null then
    return jsonb_populate_record(null::public.booking_requests, v_cached);
  end if;

  if p_play_date < app.today_kst() or p_play_date > app.today_kst() + 180 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'play_date out of range';
  end if;
  if p_golf_course_id is not null then
    perform 1 from public.golf_courses where id = p_golf_course_id and is_active;
    if not found then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown golf course';
    end if;
  end if;

  perform app.enforce_rate_limit('booking');

  insert into public.booking_requests (
    user_id, golf_course_id, course_name_free, play_date, time_pref, time_from, time_to,
    players, budget_per_person, note, sla_due_at
  ) values (
    v_uid, p_golf_course_id, nullif(trim(p_course_name_free), ''), p_play_date, p_time_pref, p_time_from, p_time_to,
    p_players, p_budget_per_person, nullif(trim(p_note), ''), app.business_sla_due(now())
  ) returning * into v_req;

  perform app.booking_event(v_req.id, null, 'requested', '부킹 요청이 접수되었습니다.');
  perform app.write_audit('booking_request', v_req.id::text, 'create', null, to_jsonb(v_req));
  perform app.enqueue_notification('booking.requested', 'admins', null, 'ADMIN_BOOKING_REQUESTED',
    app.booking_payload(v_req), format('booking:%s:requested', v_req.id));

  perform app.idempotency_finish(p_idempotency_key, to_jsonb(v_req));
  return v_req;
exception
  when check_violation or not_null_violation or invalid_text_representation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
end;
$$;

-- ── 배정: requested → in_review (재배정 시 상태 유지) ────────
create or replace function public.assign_booking(
  p_request_id uuid,
  p_assignee_id uuid,
  p_expected_version integer
) returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.booking_requests;
  v_after public.booking_requests;
begin
  perform app.require_admin();
  if not app.user_is_admin(p_assignee_id) then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'assignee must be an admin';
  end if;
  v_before := app.lock_booking(p_request_id, p_expected_version);
  if v_before.status not in ('requested', 'in_review', 'proposed') then
    perform app.invalid_state(v_before.status::text, 'assign');
  end if;

  update public.booking_requests set
    assignee_id = p_assignee_id,
    status = case when status = 'requested' then 'in_review'::public.booking_status else status end,
    first_responded_at = coalesce(first_responded_at, now()),
    version = version + 1
  where id = p_request_id
  returning * into v_after;

  if v_before.status = 'requested' then
    perform app.booking_event(v_after.id, 'requested', 'in_review', '담당자가 배정되어 확인 중입니다.');
    perform app.enqueue_notification('booking.in_review', 'customer', v_after.user_id, 'BOOKING_IN_REVIEW',
      app.booking_payload(v_after), format('booking:%s:v%s:in_review', v_after.id, v_after.version));
  end if;
  perform app.write_audit('booking_request', v_after.id::text, 'assign', to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 제안: in_review|proposed → proposed ───────────────────
create or replace function public.propose_booking(
  p_request_id uuid,
  p_expected_version integer,
  p_tee_time timestamptz,
  p_green_fee_per_person bigint,
  p_valid_minutes integer default 120,
  p_memo text default null
) returns public.booking_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.booking_requests;
  v_after public.booking_requests;
  v_proposal public.booking_proposals;
  v_withdrawn integer;
begin
  v_before := app.lock_booking(p_request_id, p_expected_version);
  if v_before.status not in ('in_review', 'proposed') then
    perform app.invalid_state(v_before.status::text, 'propose');
  end if;
  if v_before.assignee_id is distinct from v_uid and not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'only the assignee or owner can propose';
  end if;
  if p_tee_time is null or p_tee_time <= now() then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'tee_time must be in the future';
  end if;
  if p_valid_minutes is null or p_valid_minutes not between 30 and 1440 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'valid_minutes must be 30..1440';
  end if;
  if p_green_fee_per_person is null or p_green_fee_per_person < 0 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'green_fee_per_person required';
  end if;

  update public.booking_proposals set status = 'withdrawn', decided_at = now()
   where request_id = p_request_id and status = 'offered';
  get diagnostics v_withdrawn = row_count;

  insert into public.booking_proposals (request_id, tee_time, green_fee_per_person, memo, expires_at, created_by)
  values (
    p_request_id, p_tee_time, p_green_fee_per_person, nullif(trim(p_memo), ''),
    least(now() + make_interval(mins => p_valid_minutes), p_tee_time), v_uid
  ) returning * into v_proposal;

  update public.booking_requests set status = 'proposed', version = version + 1
   where id = p_request_id returning * into v_after;

  perform app.booking_event(v_after.id, v_before.status, 'proposed',
    case when v_withdrawn > 0 then '새로운 티타임이 다시 제안되었습니다.' else '티타임이 제안되었습니다.' end);
  perform app.write_audit('booking_proposal', v_proposal.id::text, 'propose', null, to_jsonb(v_proposal));
  perform app.write_audit('booking_request', v_after.id::text, 'propose', to_jsonb(v_before), to_jsonb(v_after));
  perform app.enqueue_notification('booking.proposed', 'customer', v_after.user_id, 'BOOKING_PROPOSED',
    app.booking_payload(v_after) || jsonb_build_object(
      'proposal_id', v_proposal.id, 'tee_time', v_proposal.tee_time,
      'green_fee_per_person', v_proposal.green_fee_per_person, 'expires_at', v_proposal.expires_at),
    format('proposal:%s:offered', v_proposal.id));
  return v_proposal;
end;
$$;

-- ── 수락: proposed → confirmed (고객, 멱등) ────────────────
create or replace function public.accept_proposal(
  p_idempotency_key uuid,
  p_proposal_id uuid,
  p_expected_version integer
) returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_cached jsonb;
  v_request_id uuid;
  v_before public.booking_requests;
  v_after public.booking_requests;
  v_proposal public.booking_proposals;
begin
  v_cached := app.idempotency_begin(p_idempotency_key, 'accept_proposal',
    md5(jsonb_build_object('p', p_proposal_id, 'v', p_expected_version)::text));
  if v_cached is not null then
    return jsonb_populate_record(null::public.booking_requests, v_cached);
  end if;

  select request_id into v_request_id from public.booking_proposals where id = p_proposal_id;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  v_before := app.lock_booking(v_request_id, p_expected_version);
  if v_before.user_id <> v_uid then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_before.status <> 'proposed' then
    perform app.invalid_state(v_before.status::text, 'accept');
  end if;

  select * into v_proposal from public.booking_proposals where id = p_proposal_id for update;
  if v_proposal.status <> 'offered' then
    perform app.invalid_state('proposal:' || v_proposal.status::text, 'accept');
  end if;
  if v_proposal.expires_at <= now() then
    raise exception 'proposal_expired' using errcode = 'GB409';
  end if;

  update public.booking_proposals set status = 'accepted', decided_at = now()
   where id = p_proposal_id returning * into v_proposal;
  update public.booking_requests set status = 'confirmed', version = version + 1
   where id = v_request_id returning * into v_after;

  perform app.booking_event(v_after.id, 'proposed', 'confirmed', '예약이 확정되었습니다.');
  perform app.write_audit('booking_proposal', v_proposal.id::text, 'accept', null, to_jsonb(v_proposal));
  perform app.write_audit('booking_request', v_after.id::text, 'confirm', to_jsonb(v_before), to_jsonb(v_after));
  perform app.enqueue_notification('booking.confirmed', 'customer', v_after.user_id, 'BOOKING_CONFIRMED',
    app.booking_payload(v_after) || jsonb_build_object('tee_time', v_proposal.tee_time,
      'green_fee_per_person', v_proposal.green_fee_per_person),
    format('booking:%s:confirmed', v_after.id));
  perform app.enqueue_notification('booking.confirmed', 'admins', null, 'ADMIN_BOOKING_CONFIRMED',
    app.booking_payload(v_after), format('booking:%s:confirmed:admins', v_after.id));

  perform app.idempotency_finish(p_idempotency_key, to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 제안 거절: proposed → in_review (고객) ─────────────────
create or replace function public.decline_proposal(
  p_proposal_id uuid,
  p_expected_version integer,
  p_reason text default null
) returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_request_id uuid;
  v_before public.booking_requests;
  v_after public.booking_requests;
  v_proposal public.booking_proposals;
begin
  select request_id into v_request_id from public.booking_proposals where id = p_proposal_id;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  v_before := app.lock_booking(v_request_id, p_expected_version);
  if v_before.user_id <> v_uid then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_before.status <> 'proposed' then
    perform app.invalid_state(v_before.status::text, 'decline');
  end if;
  select * into v_proposal from public.booking_proposals where id = p_proposal_id for update;
  if v_proposal.status <> 'offered' then
    perform app.invalid_state('proposal:' || v_proposal.status::text, 'decline');
  end if;

  update public.booking_proposals set status = 'declined', decided_at = now()
   where id = p_proposal_id returning * into v_proposal;
  update public.booking_requests set status = 'in_review', version = version + 1
   where id = v_request_id returning * into v_after;

  perform app.booking_event(v_after.id, 'proposed', 'in_review', '제안을 거절하셨습니다. 다른 티타임을 확인 중입니다.');
  perform app.write_audit('booking_proposal', v_proposal.id::text, 'decline', null,
    to_jsonb(v_proposal) || jsonb_build_object('reason', left(p_reason, 500)));
  perform app.write_audit('booking_request', v_after.id::text, 'decline', to_jsonb(v_before), to_jsonb(v_after));
  perform app.enqueue_notification('booking.declined', 'admins', null, 'ADMIN_PROPOSAL_DECLINED',
    app.booking_payload(v_after) || jsonb_build_object('reason', left(p_reason, 500)),
    format('proposal:%s:declined', v_proposal.id));
  return v_after;
end;
$$;

-- ── 거절: requested|in_review|proposed → rejected (운영자) ───
create or replace function public.reject_booking(
  p_request_id uuid,
  p_expected_version integer,
  p_reason text
) returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.booking_requests;
  v_after public.booking_requests;
begin
  perform app.require_admin();
  if nullif(trim(p_reason), '') is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'reason required';
  end if;
  v_before := app.lock_booking(p_request_id, p_expected_version);
  if v_before.status not in ('requested', 'in_review', 'proposed') then
    perform app.invalid_state(v_before.status::text, 'reject');
  end if;

  update public.booking_proposals set status = 'withdrawn', decided_at = now()
   where request_id = p_request_id and status = 'offered';
  update public.booking_requests set
    status = 'rejected', close_reason = left(trim(p_reason), 500),
    first_responded_at = coalesce(first_responded_at, now()), version = version + 1
  where id = p_request_id returning * into v_after;

  perform app.booking_event(v_after.id, v_before.status, 'rejected', '요청하신 조건으로는 예약이 어렵습니다: ' || v_after.close_reason);
  perform app.write_audit('booking_request', v_after.id::text, 'reject', to_jsonb(v_before), to_jsonb(v_after));
  perform app.enqueue_notification('booking.rejected', 'customer', v_after.user_id, 'BOOKING_REJECTED',
    app.booking_payload(v_after) || jsonb_build_object('reason', v_after.close_reason),
    format('booking:%s:rejected', v_after.id));
  return v_after;
end;
$$;

-- ── 취소 ─────────────────────────────────────────────────
-- 고객: requested|in_review|proposed → cancelled
-- 운영자: 위 상태 + confirmed → cancelled (사유 필수). 위약금 정책 확정 전까지 확정 건 취소는 운영자만.
create or replace function public.cancel_booking(
  p_request_id uuid,
  p_expected_version integer,
  p_reason text default null
) returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := app.is_admin();
  v_before public.booking_requests;
  v_after public.booking_requests;
begin
  if v_is_admin then
    if nullif(trim(p_reason), '') is null then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'reason required';
    end if;
  else
    perform app.require_customer();
  end if;

  v_before := app.lock_booking(p_request_id, p_expected_version);
  if v_before.status in ('requested', 'in_review', 'proposed') then
    null;
  elsif v_before.status = 'confirmed' and v_is_admin then
    null;
  else
    perform app.invalid_state(v_before.status::text, 'cancel');
  end if;

  update public.booking_proposals set status = 'withdrawn', decided_at = now()
   where request_id = p_request_id and status = 'offered';
  update public.booking_requests set
    status = 'cancelled', close_reason = left(nullif(trim(p_reason), ''), 500), version = version + 1
  where id = p_request_id returning * into v_after;

  perform app.booking_event(v_after.id, v_before.status, 'cancelled',
    case when v_is_admin then '운영자가 예약을 취소했습니다: ' || v_after.close_reason else '요청을 취소하셨습니다.' end);
  perform app.write_audit('booking_request', v_after.id::text, 'cancel', to_jsonb(v_before), to_jsonb(v_after));
  if v_is_admin then
    perform app.enqueue_notification('booking.cancelled', 'customer', v_after.user_id, 'BOOKING_CANCELLED',
      app.booking_payload(v_after) || jsonb_build_object('reason', v_after.close_reason),
      format('booking:%s:cancelled', v_after.id));
  else
    perform app.enqueue_notification('booking.cancelled', 'admins', null, 'ADMIN_BOOKING_CANCELLED',
      app.booking_payload(v_after), format('booking:%s:cancelled', v_after.id));
  end if;
  return v_after;
end;
$$;

-- ── 배치: 제안 만료 (pg_cron 1분) ──────────────────────────
-- 진행 중인 수락과 겹치면 SKIP LOCKED로 넘기고 다음 주기에 처리한다.
-- 수락 함수도 같은 요청 행을 먼저 잠그므로 두 경로는 직렬화된다.
create or replace function app.expire_proposals() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.booking_requests;
  v_after public.booking_requests;
  v_proposal public.booking_proposals;
  v_count integer := 0;
begin
  for v_req in
    select r.* from public.booking_requests r
     where r.status = 'proposed'
       and exists (select 1 from public.booking_proposals p
                    where p.request_id = r.id and p.status = 'offered' and p.expires_at <= now())
     for update of r skip locked
  loop
    update public.booking_proposals set status = 'expired', decided_at = now()
     where request_id = v_req.id and status = 'offered' and expires_at <= now()
     returning * into v_proposal;
    update public.booking_requests set status = 'in_review', version = version + 1
     where id = v_req.id returning * into v_after;

    perform app.booking_event(v_after.id, 'proposed', 'in_review', '제안 유효시간이 지나 다시 확인 중입니다.');
    perform app.write_audit('booking_proposal', v_proposal.id::text, 'expire', null, to_jsonb(v_proposal));
    perform app.write_audit('booking_request', v_after.id::text, 'expire', to_jsonb(v_req), to_jsonb(v_after));
    perform app.enqueue_notification('booking.proposal_expired', 'customer', v_after.user_id, 'BOOKING_PROPOSAL_EXPIRED',
      app.booking_payload(v_after), format('proposal:%s:expired', v_proposal.id));
    perform app.enqueue_notification('booking.proposal_expired', 'admins', null, 'ADMIN_PROPOSAL_EXPIRED',
      app.booking_payload(v_after), format('proposal:%s:expired:admins', v_proposal.id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ── 배치: SLA 초과 표시 (pg_cron 1분). 상태 전이가 아니므로 version은 올리지 않는다 ──
create or replace function app.mark_sla_breaches() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.booking_requests;
  v_count integer := 0;
begin
  for v_req in
    update public.booking_requests set sla_breached_at = now()
     where status = 'requested' and first_responded_at is null
       and sla_breached_at is null and sla_due_at < now()
     returning *
  loop
    perform app.write_audit('booking_request', v_req.id::text, 'sla_breached', null,
      jsonb_build_object('sla_due_at', v_req.sla_due_at, 'sla_breached_at', v_req.sla_breached_at));
    perform app.enqueue_notification('booking.sla_breached', 'admins', null, 'ADMIN_SLA_BREACHED',
      app.booking_payload(v_req), format('booking:%s:sla_breached', v_req.id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

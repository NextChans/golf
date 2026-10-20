-- Googolf M1: 회원권 거래 상태 함수
-- 잠금 순서: membership_deals → membership_listings (교착 방지)
-- 매물 선점은 조건부 update(WHERE status='listed')로 하고, 영향 행이 0이면 listing_unavailable.

create or replace function app.lock_deal(p_deal_id uuid, p_expected_version integer)
returns public.membership_deals
language plpgsql
set search_path = ''
as $$
declare
  v_deal public.membership_deals;
begin
  select * into v_deal from public.membership_deals where id = p_deal_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if not app.is_admin() and v_deal.user_id is distinct from auth.uid() then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if p_expected_version is null or v_deal.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'GB409',
      detail = format('expected %s, actual %s', p_expected_version, v_deal.version);
  end if;
  return v_deal;
end;
$$;

create or replace function app.deal_event(
  p_deal_id uuid, p_from public.deal_status, p_to public.deal_status, p_message text
) returns void
language sql
set search_path = ''
as $$
  insert into public.deal_events (deal_id, from_status, to_status, message)
  values (p_deal_id, p_from, p_to, p_message);
$$;

create or replace function app.deal_status_label(p_status public.deal_status) returns text
language sql immutable
set search_path = ''
as $$
  select case p_status
    when 'inquiry' then '상담 접수'
    when 'negotiating' then '가격 협의'
    when 'contract_scheduled' then '계약 일정 확정'
    when 'contracted' then '계약 체결'
    when 'transferring' then '잔금·명의개서 진행'
    when 'completed' then '거래 완료'
    when 'cancelled' then '거래 취소'
  end;
$$;

create or replace function app.deal_payload(p_deal public.membership_deals) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'deal_id', p_deal.id,
    'side', p_deal.side,
    'status', p_deal.status,
    'status_label', app.deal_status_label(p_deal.status),
    'product_name', (select name from public.membership_products where id = p_deal.product_id)
  );
$$;

-- 진행 중 거래가 매물을 점유하고 있는 단계
create or replace function app.deal_holds_listing(p_status public.deal_status) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_status in ('negotiating', 'contract_scheduled', 'contracted', 'transferring');
$$;

-- ── 상담 신청: ∅ → inquiry (고객, 멱등) ───────────────────
create or replace function public.create_deal_inquiry(
  p_idempotency_key uuid,
  p_side public.deal_side,
  p_listing_id uuid,
  p_product_id uuid,
  p_desired_price bigint,
  p_contact_window text,
  p_note text
) returns public.membership_deals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_cached jsonb;
  v_product_id uuid := p_product_id;
  v_deal public.membership_deals;
begin
  v_cached := app.idempotency_begin(p_idempotency_key, 'create_deal_inquiry', md5(jsonb_build_object(
    's', p_side, 'l', p_listing_id, 'p', p_product_id, 'd', p_desired_price, 'c', p_contact_window, 'n', p_note
  )::text));
  if v_cached is not null then
    return jsonb_populate_record(null::public.membership_deals, v_cached);
  end if;

  if p_side = 'buy' then
    select product_id into v_product_id from public.membership_listings
     where id = p_listing_id and status = 'listed';
    if not found then
      raise exception 'listing_unavailable' using errcode = 'GB409';
    end if;
  elsif p_side = 'sell' then
    if p_listing_id is not null then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'sell inquiry cannot reference a listing';
    end if;
    perform 1 from public.membership_products where id = p_product_id and is_active;
    if not found then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown product';
    end if;
  else
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'side required';
  end if;

  perform app.enforce_rate_limit('deal');

  begin
    insert into public.membership_deals (user_id, side, listing_id, product_id, desired_price, contact_window, note)
    values (v_uid, p_side, p_listing_id, v_product_id, p_desired_price,
            nullif(trim(p_contact_window), ''), nullif(trim(p_note), ''))
    returning * into v_deal;
  exception
    when unique_violation then
      raise exception 'duplicate_inquiry' using errcode = 'GB409', detail = '이미 진행 중인 상담이 있습니다';
    when check_violation then
      raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  perform app.deal_event(v_deal.id, null, 'inquiry', '상담 신청이 접수되었습니다.');
  perform app.write_audit('membership_deal', v_deal.id::text, 'create', null, to_jsonb(v_deal));
  perform app.enqueue_notification('deal.requested', 'admins', null, 'ADMIN_DEAL_REQUESTED',
    app.deal_payload(v_deal), format('deal:%s:requested', v_deal.id));

  perform app.idempotency_finish(p_idempotency_key, to_jsonb(v_deal));
  return v_deal;
end;
$$;

-- ── 협의 시작: inquiry → negotiating (운영자, 매물 선점) ──────
create or replace function public.start_deal(
  p_deal_id uuid,
  p_expected_version integer
) returns public.membership_deals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.membership_deals;
  v_after public.membership_deals;
  v_listing_before public.membership_listings;
  v_listing_after public.membership_listings;
begin
  v_before := app.lock_deal(p_deal_id, p_expected_version);
  if v_before.status <> 'inquiry' then
    perform app.invalid_state(v_before.status::text, 'start');
  end if;

  if v_before.side = 'buy' then
    select * into v_listing_before from public.membership_listings where id = v_before.listing_id;
    update public.membership_listings set status = 'reserved'
     where id = v_before.listing_id and status = 'listed'
     returning * into v_listing_after;
    if not found then
      raise exception 'listing_unavailable' using errcode = 'GB409', detail = 'listing is not listed';
    end if;
  end if;

  begin
    update public.membership_deals set
      status = 'negotiating', assignee_id = coalesce(assignee_id, v_uid), version = version + 1
    where id = p_deal_id returning * into v_after;
  exception when unique_violation then
    raise exception 'listing_unavailable' using errcode = 'GB409', detail = 'another deal holds the listing';
  end;

  perform app.deal_event(v_after.id, 'inquiry', 'negotiating', '담당자가 가격 협의를 시작했습니다.');
  perform app.write_audit('membership_deal', v_after.id::text, 'start', to_jsonb(v_before), to_jsonb(v_after));
  if v_listing_after.id is not null then
    perform app.write_audit('membership_listing', v_listing_after.id::text, 'reserve',
      to_jsonb(v_listing_before), to_jsonb(v_listing_after));
  end if;
  perform app.enqueue_notification('deal.status_changed', 'customer', v_after.user_id, 'DEAL_STATUS_CHANGED',
    app.deal_payload(v_after), format('deal:%s:v%s', v_after.id, v_after.version));
  return v_after;
end;
$$;

-- ── 합의가·계약일 수정 (운영자, 상태 변경 없음) ─────────────
create or replace function public.update_deal_terms(
  p_deal_id uuid,
  p_expected_version integer,
  p_agreed_price bigint,
  p_contract_date date
) returns public.membership_deals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.membership_deals;
  v_after public.membership_deals;
begin
  v_before := app.lock_deal(p_deal_id, p_expected_version);
  if v_before.assignee_id is distinct from v_uid and not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'only the assignee or owner can update terms';
  end if;
  if v_before.status in ('completed', 'cancelled', 'inquiry') then
    perform app.invalid_state(v_before.status::text, 'update_terms');
  end if;
  if p_agreed_price is not null and p_agreed_price <= 0 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'agreed_price must be positive';
  end if;

  update public.membership_deals set
    agreed_price = p_agreed_price, contract_date = p_contract_date, version = version + 1
  where id = p_deal_id returning * into v_after;

  perform app.write_audit('membership_deal', v_after.id::text, 'update_terms', to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 단계 진행 (운영자, 한 칸씩 전진만) ─────────────────────
-- negotiating → contract_scheduled(계약일 필수) → contracted(합의가 필수) → transferring → completed
create or replace function public.advance_deal(
  p_deal_id uuid,
  p_expected_version integer,
  p_to_status public.deal_status
) returns public.membership_deals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.membership_deals;
  v_after public.membership_deals;
  v_next public.deal_status;
  v_listing_before public.membership_listings;
  v_listing_after public.membership_listings;
begin
  v_before := app.lock_deal(p_deal_id, p_expected_version);
  if v_before.assignee_id is distinct from v_uid and not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'only the assignee or owner can advance';
  end if;

  v_next := case v_before.status
    when 'negotiating' then 'contract_scheduled'
    when 'contract_scheduled' then 'contracted'
    when 'contracted' then 'transferring'
    when 'transferring' then 'completed'
  end;
  if v_next is null or p_to_status is distinct from v_next then
    perform app.invalid_state(v_before.status::text, 'advance to ' || coalesce(p_to_status::text, 'null'));
  end if;
  if v_next = 'contract_scheduled' and v_before.contract_date is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'contract_date required';
  end if;
  if v_next = 'contracted' and v_before.agreed_price is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'agreed_price required';
  end if;

  if v_next = 'completed' and v_before.side = 'buy' then
    select * into v_listing_before from public.membership_listings where id = v_before.listing_id;
    update public.membership_listings set status = 'sold'
     where id = v_before.listing_id and status = 'reserved'
     returning * into v_listing_after;
    if not found then
      raise exception 'invalid_state' using errcode = 'GB409', detail = 'listing is not reserved';
    end if;
  end if;

  update public.membership_deals set status = v_next, version = version + 1
   where id = p_deal_id returning * into v_after;

  perform app.deal_event(v_after.id, v_before.status, v_next, app.deal_status_label(v_next) || ' 단계로 진행되었습니다.');
  perform app.write_audit('membership_deal', v_after.id::text, 'advance', to_jsonb(v_before), to_jsonb(v_after));
  if v_listing_after.id is not null then
    perform app.write_audit('membership_listing', v_listing_after.id::text, 'sell',
      to_jsonb(v_listing_before), to_jsonb(v_listing_after));
  end if;
  perform app.enqueue_notification('deal.status_changed', 'customer', v_after.user_id, 'DEAL_STATUS_CHANGED',
    app.deal_payload(v_after), format('deal:%s:v%s', v_after.id, v_after.version));
  return v_after;
end;
$$;

-- ── 취소: 진행 중 → cancelled. 점유 중인 매물은 같은 트랜잭션에서 listed로 복원 ──
-- 고객은 inquiry·negotiating 단계까지만 직접 취소. 이후는 운영자(사유 필수).
create or replace function public.cancel_deal(
  p_deal_id uuid,
  p_expected_version integer,
  p_reason text default null
) returns public.membership_deals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := app.is_admin();
  v_before public.membership_deals;
  v_after public.membership_deals;
  v_listing_before public.membership_listings;
  v_listing_after public.membership_listings;
begin
  if v_is_admin then
    if nullif(trim(p_reason), '') is null then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'reason required';
    end if;
  else
    perform app.require_customer();
  end if;

  v_before := app.lock_deal(p_deal_id, p_expected_version);
  if v_before.status in ('completed', 'cancelled') then
    perform app.invalid_state(v_before.status::text, 'cancel');
  end if;
  if not v_is_admin and v_before.status not in ('inquiry', 'negotiating') then
    perform app.invalid_state(v_before.status::text, 'customer cancel');
  end if;

  if v_before.side = 'buy' and app.deal_holds_listing(v_before.status) then
    select * into v_listing_before from public.membership_listings where id = v_before.listing_id;
    update public.membership_listings set status = 'listed'
     where id = v_before.listing_id and status = 'reserved'
     returning * into v_listing_after;
    if not found then
      raise exception 'invalid_state' using errcode = 'GB409', detail = 'listing is not reserved';
    end if;
  end if;

  update public.membership_deals set
    status = 'cancelled', close_reason = left(nullif(trim(p_reason), ''), 500), version = version + 1
  where id = p_deal_id returning * into v_after;

  perform app.deal_event(v_after.id, v_before.status, 'cancelled',
    case when v_is_admin then '거래가 취소되었습니다: ' || v_after.close_reason else '상담을 취소하셨습니다.' end);
  perform app.write_audit('membership_deal', v_after.id::text, 'cancel', to_jsonb(v_before), to_jsonb(v_after));
  if v_listing_after.id is not null then
    perform app.write_audit('membership_listing', v_listing_after.id::text, 'release',
      to_jsonb(v_listing_before), to_jsonb(v_listing_after));
  end if;
  if v_is_admin then
    perform app.enqueue_notification('deal.status_changed', 'customer', v_after.user_id, 'DEAL_STATUS_CHANGED',
      app.deal_payload(v_after), format('deal:%s:v%s', v_after.id, v_after.version));
  else
    perform app.enqueue_notification('deal.cancelled', 'admins', null, 'ADMIN_DEAL_CANCELLED',
      app.deal_payload(v_after), format('deal:%s:cancelled', v_after.id));
  end if;
  return v_after;
end;
$$;

-- ── 매물 노출 전환: listed ↔ hidden (운영자) ──────────────
-- reserved/sold는 거래 함수로만 바뀐다.
create or replace function public.set_listing_visibility(
  p_listing_id uuid,
  p_visible boolean
) returns public.membership_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.membership_listings;
  v_after public.membership_listings;
begin
  perform app.require_admin();
  select * into v_before from public.membership_listings where id = p_listing_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_before.status not in ('listed', 'hidden') then
    perform app.invalid_state(v_before.status::text, 'set_visibility');
  end if;

  update public.membership_listings
     set status = case when p_visible then 'listed'::public.listing_status else 'hidden'::public.listing_status end
   where id = p_listing_id returning * into v_after;

  if v_after.status is distinct from v_before.status then
    perform app.write_audit('membership_listing', v_after.id::text,
      case when p_visible then 'list' else 'hide' end, to_jsonb(v_before), to_jsonb(v_after));
  end if;
  return v_after;
end;
$$;

-- Googolf M5: 회원권 마스터 관리(A-04) — 상품·매물·시세 저장, 거래 담당자 배정(A-05)
-- 매물 상태 전이(listed/reserved/sold/hidden)는 기존 함수(set_listing_visibility, start_deal, cancel_deal, advance_deal)만 바꾼다.

-- ── 회원권 상품(골프장 × 종류) ─────────────────────────────
create or replace function public.upsert_membership_product(
  p_id uuid,
  p_golf_course_id uuid,
  p_kind text,
  p_name text,
  p_is_active boolean
) returns public.membership_products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.membership_products;
  v_after public.membership_products;
begin
  perform app.require_admin();
  p_kind := nullif(trim(p_kind), '');
  p_name := nullif(trim(p_name), '');
  if p_kind is null or p_name is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'kind and name required';
  end if;
  perform 1 from public.golf_courses where id = p_golf_course_id;
  if not found then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'golf course not found';
  end if;

  begin
    if p_id is null then
      insert into public.membership_products (golf_course_id, kind, name, is_active)
      values (p_golf_course_id, p_kind, p_name, coalesce(p_is_active, true))
      returning * into v_after;
    else
      select * into v_before from public.membership_products where id = p_id for update;
      if not found then
        raise exception 'not_found' using errcode = 'GB404';
      end if;
      update public.membership_products set
        golf_course_id = p_golf_course_id, kind = p_kind, name = p_name,
        is_active = coalesce(p_is_active, is_active)
      where id = p_id returning * into v_after;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate_name' using errcode = 'GB409', detail = '같은 골프장에 같은 종류가 있습니다';
    when check_violation then
      raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  perform app.write_audit('membership_product', v_after.id::text, case when p_id is null then 'create' else 'update' end,
    to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 매물 저장: 새 매물은 hidden으로 만들고 공개는 set_listing_visibility로 ──
-- 호가는 hidden·listed일 때만 바꾼다(협의 중 호가 변경 금지). 판매완료 매물은 수정 불가.
create or replace function public.upsert_listing(
  p_id uuid,
  p_product_id uuid,
  p_asking_price bigint,
  p_description text
) returns public.membership_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.membership_listings;
  v_after public.membership_listings;
begin
  if p_asking_price is null or p_asking_price <= 0 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'asking_price must be positive';
  end if;
  perform 1 from public.membership_products where id = p_product_id;
  if not found then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'product not found';
  end if;

  begin
    if p_id is null then
      insert into public.membership_listings (product_id, asking_price, description, status, created_by)
      values (p_product_id, p_asking_price, nullif(trim(p_description), ''), 'hidden', v_uid)
      returning * into v_after;
    else
      select * into v_before from public.membership_listings where id = p_id for update;
      if not found then
        raise exception 'not_found' using errcode = 'GB404';
      end if;
      if v_before.status = 'sold' then
        perform app.invalid_state('sold', 'edit_listing');
      end if;
      if v_before.status = 'reserved'
         and (p_asking_price <> v_before.asking_price or p_product_id <> v_before.product_id) then
        perform app.invalid_state('reserved', 'change_price');
      end if;
      update public.membership_listings set
        product_id = p_product_id, asking_price = p_asking_price, description = nullif(trim(p_description), '')
      where id = p_id returning * into v_after;
    end if;
  exception when check_violation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  perform app.write_audit('membership_listing', v_after.id::text, case when p_id is null then 'create' else 'update' end,
    to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 시세(일자별, 같은 날은 덮어쓰기) ──────────────────────
create or replace function public.upsert_quote(
  p_product_id uuid,
  p_quoted_on date,
  p_buy_price bigint,
  p_sell_price bigint
) returns public.membership_quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.membership_quotes;
  v_after public.membership_quotes;
begin
  if p_quoted_on is null or p_quoted_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'quoted_on must not be in the future';
  end if;
  if p_buy_price is null and p_sell_price is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'buy or sell price required';
  end if;
  perform 1 from public.membership_products where id = p_product_id;
  if not found then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'product not found';
  end if;

  select * into v_before from public.membership_quotes
   where product_id = p_product_id and quoted_on = p_quoted_on for update;
  begin
    insert into public.membership_quotes (product_id, quoted_on, buy_price, sell_price, created_by)
    values (p_product_id, p_quoted_on, p_buy_price, p_sell_price, v_uid)
    on conflict (product_id, quoted_on) do update set
      buy_price = excluded.buy_price, sell_price = excluded.sell_price, created_by = excluded.created_by
    returning * into v_after;
  exception when check_violation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  perform app.write_audit('membership_quote', v_after.id::text, case when v_before.id is null then 'create' else 'update' end,
    to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 거래 담당자 배정(모든 운영자, D-15). 상태는 바꾸지 않는다 ──
create or replace function public.assign_deal(
  p_deal_id uuid,
  p_assignee_id uuid,
  p_expected_version integer
) returns public.membership_deals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.membership_deals;
  v_after public.membership_deals;
begin
  perform app.require_admin();
  if not app.user_is_admin(p_assignee_id) then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'assignee must be an admin';
  end if;
  v_before := app.lock_deal(p_deal_id, p_expected_version);
  if v_before.status in ('completed', 'cancelled') then
    perform app.invalid_state(v_before.status::text, 'assign');
  end if;

  update public.membership_deals set assignee_id = p_assignee_id, version = version + 1
   where id = p_deal_id returning * into v_after;
  perform app.write_audit('membership_deal', v_after.id::text, 'assign', to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- 매물 목록 필터(지역·가격)용
create index if not exists membership_products_course_idx on public.membership_products (golf_course_id);
create index if not exists membership_quotes_product_idx on public.membership_quotes (product_id, quoted_on desc);
create index if not exists membership_deals_assignee_idx on public.membership_deals (assignee_id, status);

revoke execute on function
  public.upsert_membership_product(uuid, uuid, text, text, boolean),
  public.upsert_listing(uuid, uuid, bigint, text),
  public.upsert_quote(uuid, date, bigint, bigint),
  public.assign_deal(uuid, uuid, integer)
from public, anon, service_role;
grant execute on function
  public.upsert_membership_product(uuid, uuid, text, text, boolean),
  public.upsert_listing(uuid, uuid, bigint, text),
  public.upsert_quote(uuid, date, bigint, bigint),
  public.assign_deal(uuid, uuid, integer)
to authenticated;

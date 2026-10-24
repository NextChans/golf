-- Googolf: 시세 자동 반영(D-74)과 개인정보 열람 기록(D-75)
-- 1) 거래 완료 체결가를 membership_trades에 자동 기록한다(advance_deal이 completed로 바꾸는 같은 트랜잭션, 트리거)
-- 2) 운영자 시세 일괄 입력(CSV) — 시세 행에 출처(source)를 남긴다
-- 3) 운영자가 상세 화면에서 고객 연락처를 볼 때 감사 로그(같은 운영자·대상은 10분에 1건)

-- ── 시세 출처 ─────────────────────────────────────────────
alter table public.membership_quotes
  add column source text not null default 'admin' check (source in ('admin', 'csv'));

-- ── 체결가(공개: 상품·가격·날짜만, 고객·거래 식별 정보 없음) ──
create table public.membership_trades (
  id bigint generated always as identity primary key,
  deal_id uuid not null unique references public.membership_deals (id),
  product_id uuid not null references public.membership_products (id),
  side public.deal_side not null,
  price bigint not null check (price > 0),
  traded_on date not null,
  created_at timestamptz not null default now()
);
create index membership_trades_product_idx on public.membership_trades (product_id, traded_on desc);

alter table public.membership_trades enable row level security;
revoke all on public.membership_trades from anon, authenticated, service_role;
-- deal_id는 공개하지 않는다(컬럼 권한)
grant select (id, product_id, side, price, traded_on) on public.membership_trades to anon, authenticated;
create policy membership_trades_select on public.membership_trades for select to anon, authenticated using (true);

create or replace function app.record_trade() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.agreed_price is not null and new.product_id is not null then
    insert into public.membership_trades (deal_id, product_id, side, price, traded_on)
    values (new.id, new.product_id, new.side, new.agreed_price, (now() at time zone 'Asia/Seoul')::date)
    on conflict (deal_id) do nothing;
    perform app.write_audit('membership_trade', new.id::text, 'record', null,
      jsonb_build_object('product_id', new.product_id, 'price', new.agreed_price));
  end if;
  return new;
end;
$$;

create trigger membership_deals_record_trade after update of status on public.membership_deals
  for each row execute function app.record_trade();

-- ── 시세 일괄 입력(운영자, CSV) ─────────────────────────────
-- p_rows: [{"product_id": uuid, "quoted_on": "YYYY-MM-DD", "buy_price": n|null, "sell_price": n|null}, ...] 최대 500행
-- 한 트랜잭션: 한 행이라도 잘못되면 전부 반영하지 않는다(어느 행인지 detail에 남김)
create or replace function public.bulk_upsert_quotes(p_rows jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_quote public.membership_quotes;
  v_i integer := 0;
begin
  perform app.require_admin();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'rows 1..500';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    begin
      v_quote := public.upsert_quote(
        (v_row ->> 'product_id')::uuid,
        (v_row ->> 'quoted_on')::date,
        nullif(v_row ->> 'buy_price', '')::bigint,
        nullif(v_row ->> 'sell_price', '')::bigint);
    exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
      raise exception 'invalid_input' using errcode = 'GB422', detail = format('row %s: format', v_i);
    end;
    update public.membership_quotes set source = 'csv' where id = v_quote.id;
  end loop;
  perform app.write_audit('membership_quote', 'bulk', 'bulk_upsert', null, jsonb_build_object('rows', v_i));
  return v_i;
end;
$$;

-- ── 개인정보 열람 기록(운영자) ───────────────────────────────
create or replace function public.log_pii_view(p_subject_type text, p_subject_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_key text := p_subject_type || ':' || p_subject_id::text;
begin
  if p_subject_type not in ('customer', 'booking', 'deal') or p_subject_id is null then
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
create index if not exists audit_logs_pii_view_idx on public.audit_logs (actor_id, entity_id, occurred_at desc)
  where entity_type = 'pii_view';

revoke execute on function public.bulk_upsert_quotes(jsonb), public.log_pii_view(text, uuid) from public, anon, service_role;
grant execute on function public.bulk_upsert_quotes(jsonb), public.log_pii_view(text, uuid) to authenticated;

-- Googolf M1: RLS, 권한, cron
-- 원칙
--  1) 모든 테이블 RLS on, 기본 거부. 정책은 SELECT만 정의한다.
--  2) anon/authenticated/service_role에서 테이블 DML 권한을 전부 회수한다.
--     데이터 변경은 security definer 함수로만 일어난다(함수 소유자 postgres가 수행).
--  3) 함수 EXECUTE도 기본 회수 후 필요한 함수만 명시적으로 부여한다.

-- ── RLS 활성화 ───────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'terms_agreements', 'business_holidays', 'golf_courses',
    'booking_requests', 'booking_proposals', 'booking_events',
    'membership_products', 'membership_quotes', 'membership_listings', 'membership_deals', 'deal_events',
    'activity_notes', 'audit_logs', 'notification_outbox', 'idempotency_keys'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ── 권한 회수 ────────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke execute on all functions in schema public from public, anon, authenticated, service_role;
revoke execute on all functions in schema app from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema app revoke execute on functions from public;

-- audit_logs: 모든 역할에서 update/delete/truncate 회수(트리거로 이중 차단)
revoke update, delete, truncate on public.audit_logs from public, anon, authenticated, service_role;

-- ── 조회 권한 + RLS 정책 ──────────────────────────────────
grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.jwt_role(), app.is_admin(), app.is_owner() to anon, authenticated, service_role;

-- profiles: 본인 또는 운영자
grant select on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select app.is_admin()));

grant select on public.terms_agreements to authenticated;
create policy terms_select on public.terms_agreements for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_admin()));

grant select on public.business_holidays to authenticated;
create policy holidays_select on public.business_holidays for select to authenticated using (true);

-- 골프장: 활성 골프장은 누구나, 비활성은 운영자만
grant select on public.golf_courses to anon, authenticated;
create policy golf_courses_select on public.golf_courses for select to anon, authenticated
  using (is_active or (select app.is_admin()));

-- 부킹: 본인 또는 운영자
grant select on public.booking_requests to authenticated;
create policy booking_requests_select on public.booking_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_admin()));

grant select on public.booking_proposals to authenticated;
create policy booking_proposals_select on public.booking_proposals for select to authenticated
  using ((select app.is_admin()) or exists (
    select 1 from public.booking_requests r where r.id = request_id and r.user_id = (select auth.uid())));

grant select on public.booking_events to authenticated;
create policy booking_events_select on public.booking_events for select to authenticated
  using ((select app.is_admin()) or exists (
    select 1 from public.booking_requests r where r.id = request_id and r.user_id = (select auth.uid())));

-- 회원권 상품·시세: 공개
grant select on public.membership_products to anon, authenticated;
create policy membership_products_select on public.membership_products for select to anon, authenticated
  using (is_active or (select app.is_admin()));

-- created_by(운영자 id)는 공개하지 않는다
grant select (id, product_id, quoted_on, buy_price, sell_price, created_at) on public.membership_quotes to anon, authenticated;
create policy membership_quotes_select on public.membership_quotes for select to anon, authenticated
  using (true);

-- 매물: hidden 외에는 공개(결정 D-16). 법률 자문 후 이 정책만 바꾸면 된다.
grant select (id, product_id, asking_price, description, status, created_at, updated_at) on public.membership_listings to anon, authenticated;
create policy membership_listings_select on public.membership_listings for select to anon, authenticated
  using (status <> 'hidden' or (select app.is_admin()));

grant select on public.membership_deals to authenticated;
create policy membership_deals_select on public.membership_deals for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_admin()));

grant select on public.deal_events to authenticated;
create policy deal_events_select on public.deal_events for select to authenticated
  using ((select app.is_admin()) or exists (
    select 1 from public.membership_deals d where d.id = deal_id and d.user_id = (select auth.uid())));

-- 운영자 전용
grant select on public.activity_notes to authenticated;
create policy activity_notes_select on public.activity_notes for select to authenticated
  using ((select app.is_admin()));

grant select on public.notification_outbox to authenticated;
create policy outbox_select on public.notification_outbox for select to authenticated
  using ((select app.is_admin()));

-- 감사 로그: owner 전용
grant select on public.audit_logs to authenticated;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select app.is_owner()));

-- idempotency_keys: 정책 없음(완전 비공개)

-- ── RPC 실행 권한 ────────────────────────────────────────
grant execute on function
  public.create_booking_request(uuid, uuid, text, date, public.time_pref, time, time, integer, bigint, text),
  public.assign_booking(uuid, uuid, integer),
  public.propose_booking(uuid, integer, timestamptz, bigint, integer, text),
  public.accept_proposal(uuid, uuid, integer),
  public.decline_proposal(uuid, integer, text),
  public.reject_booking(uuid, integer, text),
  public.cancel_booking(uuid, integer, text),
  public.create_deal_inquiry(uuid, public.deal_side, uuid, uuid, bigint, text, text),
  public.start_deal(uuid, integer),
  public.update_deal_terms(uuid, integer, bigint, date),
  public.advance_deal(uuid, integer, public.deal_status),
  public.cancel_deal(uuid, integer, text),
  public.set_listing_visibility(uuid, boolean)
to authenticated;

-- ── cron ────────────────────────────────────────────────
select cron.schedule('expire-proposals', '* * * * *', $$select app.expire_proposals()$$);
select cron.schedule('mark-sla-breaches', '* * * * *', $$select app.mark_sla_breaches()$$);
select cron.schedule('purge-idempotency-keys', '17 * * * *',
  $$delete from public.idempotency_keys where created_at < now() - interval '24 hours'$$);

-- Googolf 운영 DB 스키마 일괄 적용 (자동 생성: node scripts/bundle-migrations.mjs)
-- 포함 마이그레이션: 20261020000001_extensions_enums.sql, 20261020000002_tables.sql, 20261020000003_helpers.sql, 20261020000004_booking_functions.sql, 20261020000005_membership_functions.sql, 20261020000006_rls_grants_cron.sql, 20261020000007_auth_onboarding.sql, 20261020000008_app_settings.sql
-- Supabase 대시보드 → SQL Editor → 새 쿼리에 전체를 붙여넣고 Run. 이미 적용된 버전은 다시 실행하지 말 것.
begin;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
-- 이미 적용된 마이그레이션이 하나라도 있으면 중단(이중 적용 방지)
do $$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version in ('20261020000001', '20261020000002', '20261020000003', '20261020000004', '20261020000005', '20261020000006', '20261020000007', '20261020000008')) then
    raise exception '이미 적용된 마이그레이션이 있습니다. supabase_migrations.schema_migrations를 확인하세요.';
  end if;
end $$;

-- ════════ 20261020000001_extensions_enums.sql ════════
-- Googolf M1: 확장, 내부 스키마, enum 타입
-- 상태 머신 정의는 docs/state-machine.md 참고. enum 값을 바꾸면 문서와 lib/domain 상수도 함께 바꾼다.

create extension if not exists pg_cron;
create extension if not exists pgcrypto with schema extensions;

-- 내부 헬퍼 전용 스키마. PostgREST에 노출하지 않는다(config.toml api.schemas에 넣지 않음).
create schema if not exists app;
revoke all on schema app from public;

create type public.region as enum (
  'seoul_gyeonggi', 'gangwon', 'chungcheong', 'jeolla', 'gyeongsang', 'jeju'
);

create type public.time_pref as enum ('part_1', 'part_2', 'range');

create type public.booking_status as enum (
  'requested', 'in_review', 'proposed', 'confirmed', 'rejected', 'cancelled'
);

create type public.proposal_status as enum (
  'offered', 'accepted', 'declined', 'expired', 'withdrawn'
);

create type public.listing_status as enum ('listed', 'reserved', 'sold', 'hidden');

create type public.deal_side as enum ('buy', 'sell');

create type public.deal_status as enum (
  'inquiry', 'negotiating', 'contract_scheduled', 'contracted', 'transferring', 'completed', 'cancelled'
);

create type public.notify_channel as enum ('alimtalk', 'sms', 'slack', 'email');

create type public.outbox_status as enum ('pending', 'sending', 'sent', 'failed', 'dead');

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000001', 'extensions_enums');

-- ════════ 20261020000002_tables.sql ════════
-- Googolf M1: 테이블, 제약, 인덱스
-- 금액은 bigint(원), 시각은 timestamptz. 날짜(play_date 등)는 KST 기준 date.

create or replace function app.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 사용자 ────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  onboarded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.terms_agreements (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  terms_code text not null check (terms_code ~ '^[a-z_]{2,40}$'),
  version text not null check (char_length(version) between 1 and 20),
  agreed_at timestamptz not null default now(),
  unique (user_id, terms_code, version)
);

-- SLA 계산에서 제외할 공휴일(KST 날짜). 운영자가 관리한다.
create table public.business_holidays (
  holiday date primary key,
  name text not null
);

-- ── 골프장 ────────────────────────────────────────────────
create table public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  region public.region not null,
  address text check (char_length(address) <= 200),
  weekday_green_fee bigint check (weekday_green_fee >= 0),
  weekend_green_fee bigint check (weekend_green_fee >= 0),
  cancellation_policy text check (char_length(cancellation_policy) <= 2000),
  contact_phone text check (char_length(contact_phone) <= 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index golf_courses_region_idx on public.golf_courses (region) where is_active;

-- ── 부킹 ─────────────────────────────────────────────────
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  golf_course_id uuid references public.golf_courses (id),
  course_name_free text check (char_length(course_name_free) between 1 and 100),
  play_date date not null,
  time_pref public.time_pref not null,
  time_from time,
  time_to time,
  players smallint not null check (players between 1 and 4),
  budget_per_person bigint check (budget_per_person >= 0),
  note text check (char_length(note) <= 1000),
  status public.booking_status not null default 'requested',
  assignee_id uuid references public.profiles (id),
  version integer not null default 1,
  sla_due_at timestamptz not null,
  first_responded_at timestamptz,
  sla_breached_at timestamptz,
  close_reason text check (char_length(close_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_course_xor check ((golf_course_id is null) <> (course_name_free is null)),
  constraint booking_time_range check (
    (time_pref = 'range' and time_from is not null and time_to is not null and time_from < time_to)
    or (time_pref <> 'range' and time_from is null and time_to is null)
  )
);
create index booking_requests_user_idx on public.booking_requests (user_id, created_at desc);
create index booking_requests_status_idx on public.booking_requests (status, created_at);
create index booking_requests_assignee_idx on public.booking_requests (assignee_id, status);
create index booking_requests_sla_idx on public.booking_requests (sla_due_at)
  where first_responded_at is null and sla_breached_at is null;

create table public.booking_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests (id),
  tee_time timestamptz not null,
  green_fee_per_person bigint not null check (green_fee_per_person >= 0),
  memo text check (char_length(memo) <= 500),
  expires_at timestamptz not null,
  status public.proposal_status not null default 'offered',
  created_by uuid not null references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposal_expiry_before_tee check (expires_at <= tee_time)
);
-- 요청당 수락된 제안 1건, 살아있는 제안 1건
create unique index booking_proposals_one_accepted on public.booking_proposals (request_id)
  where status = 'accepted';
create unique index booking_proposals_one_offered on public.booking_proposals (request_id)
  where status = 'offered';
create index booking_proposals_request_idx on public.booking_proposals (request_id, created_at desc);
create index booking_proposals_expiry_idx on public.booking_proposals (expires_at)
  where status = 'offered';

-- 고객에게 보여주는 타임라인. 내부 정보는 audit_logs에만 남긴다.
create table public.booking_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.booking_requests (id),
  from_status public.booking_status,
  to_status public.booking_status not null,
  message text,
  created_at timestamptz not null default now()
);
create index booking_events_request_idx on public.booking_events (request_id, id);

-- ── 회원권 ────────────────────────────────────────────────
create table public.membership_products (
  id uuid primary key default gen_random_uuid(),
  golf_course_id uuid not null references public.golf_courses (id),
  kind text not null check (char_length(kind) between 1 and 30),
  name text not null check (char_length(name) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (golf_course_id, kind)
);

create table public.membership_quotes (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.membership_products (id),
  quoted_on date not null,
  buy_price bigint check (buy_price >= 0),
  sell_price bigint check (sell_price >= 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (product_id, quoted_on),
  check (buy_price is not null or sell_price is not null)
);

create table public.membership_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.membership_products (id),
  asking_price bigint not null check (asking_price > 0),
  description text check (char_length(description) <= 2000),
  status public.listing_status not null default 'hidden',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membership_listings_status_price_idx on public.membership_listings (status, asking_price);
create index membership_listings_product_idx on public.membership_listings (product_id);

create table public.membership_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  side public.deal_side not null,
  listing_id uuid references public.membership_listings (id),
  product_id uuid references public.membership_products (id),
  desired_price bigint check (desired_price > 0),
  agreed_price bigint check (agreed_price > 0),
  contract_date date,
  contact_window text check (char_length(contact_window) <= 100),
  note text check (char_length(note) <= 1000),
  status public.deal_status not null default 'inquiry',
  assignee_id uuid references public.profiles (id),
  version integer not null default 1,
  close_reason text check (char_length(close_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_buy_requires_listing check (side <> 'buy' or listing_id is not null),
  constraint deal_sell_requires_product check (side <> 'sell' or product_id is not null)
);
create index membership_deals_user_idx on public.membership_deals (user_id, created_at desc);
create index membership_deals_status_idx on public.membership_deals (status, created_at);
-- 매물 선점의 최후 방어선: 진행 중 거래는 매물당 1건
create unique index membership_deals_one_active_per_listing on public.membership_deals (listing_id)
  where status in ('negotiating', 'contract_scheduled', 'contracted', 'transferring');
-- 같은 고객이 같은 매물에 진행 중인 상담을 중복으로 열지 못한다
create unique index membership_deals_one_open_per_user_listing on public.membership_deals (user_id, listing_id)
  where status not in ('completed', 'cancelled') and listing_id is not null;

create table public.deal_events (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.membership_deals (id),
  from_status public.deal_status,
  to_status public.deal_status not null,
  message text,
  created_at timestamptz not null default now()
);
create index deal_events_deal_idx on public.deal_events (deal_id, id);

-- ── CRM 메모(운영자 전용, append-only) ─────────────────────
create table public.activity_notes (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.profiles (id),
  subject_type text not null check (subject_type in ('customer', 'booking', 'deal')),
  subject_id uuid,
  body text not null check (char_length(body) between 1 and 2000),
  author_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index activity_notes_customer_idx on public.activity_notes (customer_id, created_at desc);

-- ── 감사 로그(append-only) ────────────────────────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at);

create or replace function app.audit_logs_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'GB403';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function app.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function app.audit_logs_immutable();

-- ── 알림 outbox ──────────────────────────────────────────
-- 수신자 전화번호는 넣지 않는다. 발송 시점에 조회한다.
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  recipient_kind text not null check (recipient_kind in ('customer', 'admins')),
  recipient_user_id uuid references public.profiles (id),
  channel public.notify_channel not null,
  template_code text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbox_customer_has_recipient check (recipient_kind <> 'customer' or recipient_user_id is not null)
);
create index notification_outbox_due_idx on public.notification_outbox (next_attempt_at)
  where status in ('pending', 'failed');

-- ── 멱등키 ───────────────────────────────────────────────
create table public.idempotency_keys (
  user_id uuid not null,
  key uuid not null,
  action text not null,
  request_hash text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index idempotency_keys_created_idx on public.idempotency_keys (created_at);

-- ── updated_at 트리거 ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'golf_courses', 'booking_requests', 'booking_proposals',
    'membership_products', 'membership_listings', 'membership_deals', 'notification_outbox'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function app.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000002', 'tables');

-- ════════ 20261020000003_helpers.sql ════════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000003', 'helpers');

-- ════════ 20261020000004_booking_functions.sql ════════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000004', 'booking_functions');

-- ════════ 20261020000005_membership_functions.sql ════════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000005', 'membership_functions');

-- ════════ 20261020000006_rls_grants_cron.sql ════════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000006', 'rls_grants_cron');

-- ════════ 20261020000007_auth_onboarding.sql ════════
-- Googolf M2: 인증·온보딩·운영자 관리
-- D-26: 고객=카카오, 관리자=이메일(owner가 Admin API로 발급)+TOTP. 카카오 계정은 관리자가 될 수 없다.

-- ── 공개 가입 차단 훅 ────────────────────────────────────
-- Auth의 before_user_created 훅. Admin API로 만드는 계정에는 호출되지 않는다(M2에서 확인).
-- 공개 가입 경로 중 카카오 OAuth만 허용하고 이메일·휴대폰 자가 가입은 거부한다.
create or replace function public.before_user_created_hook(event jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '') = 'kakao' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', '카카오 로그인으로만 가입할 수 있습니다.'));
end;
$$;
revoke execute on function public.before_user_created_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

-- ── 운영자 판별 강화: 카카오 identity가 있는 세션은 운영자로 인정하지 않는다 ──
create or replace function app.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select app.jwt_role() in ('admin', 'owner')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and not coalesce((auth.jwt() -> 'app_metadata' -> 'providers') ? 'kakao', false);
$$;

create or replace function app.is_owner() returns boolean
language sql stable
set search_path = ''
as $$
  select app.jwt_role() = 'owner' and app.is_admin();
$$;

-- ── 약관 ───────────────────────────────────────────────
create table public.terms_versions (
  code text not null check (code ~ '^[a-z_]{2,40}$'),
  version text not null check (char_length(version) between 1 and 20),
  title text not null,
  required boolean not null,
  effective_at timestamptz not null default now(),
  primary key (code, version)
);
alter table public.terms_versions enable row level security;
grant select on public.terms_versions to anon, authenticated;
create policy terms_versions_select on public.terms_versions for select to anon, authenticated using (true);

insert into public.terms_versions (code, version, title, required, effective_at) values
  ('service', '2026-10-20', '서비스 이용약관', true, '2026-10-20 00:00:00+09'),
  ('privacy', '2026-10-20', '개인정보 수집·이용 동의', true, '2026-10-20 00:00:00+09'),
  ('marketing', '2026-10-20', '마케팅 정보 수신 동의', false, '2026-10-20 00:00:00+09');

-- 코드별 현재 시행 중인 최신 버전
create or replace view public.current_terms with (security_invoker = true) as
  select distinct on (code) code, version, title, required, effective_at
    from public.terms_versions
   where effective_at <= now()
   order by code, effective_at desc;
grant select on public.current_terms to anon, authenticated;

-- ── 온보딩: 휴대폰 인증(Auth phone_change OTP) + 약관 동의 → profiles ──
create or replace function public.complete_onboarding(
  p_display_name text,
  p_agreed_codes text[]
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
  v_user auth.users;
  v_missing text;
  v_before public.profiles;
  v_after public.profiles;
begin
  if app.jwt_role() <> 'customer' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'staff accounts do not onboard';
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'kakao') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'kakao account required';
  end if;
  if v_user.phone is null or v_user.phone = '' or v_user.phone_confirmed_at is null then
    raise exception 'phone_not_verified' using errcode = 'GB422';
  end if;

  p_display_name := nullif(trim(p_display_name), '');
  if p_display_name is null or char_length(p_display_name) > 50 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'display_name 1..50';
  end if;

  select string_agg(code, ',') into v_missing
    from public.current_terms
   where required and not (code = any (coalesce(p_agreed_codes, '{}')));
  if v_missing is not null then
    raise exception 'terms_required' using errcode = 'GB422', detail = v_missing;
  end if;

  select * into v_before from public.profiles where id = v_uid;

  insert into public.profiles (id, display_name, phone, phone_verified_at, onboarded_at)
  values (v_uid, p_display_name, '+' || ltrim(v_user.phone, '+'), v_user.phone_confirmed_at, now())
  on conflict (id) do update set
    display_name = excluded.display_name,
    phone = excluded.phone,
    phone_verified_at = excluded.phone_verified_at,
    onboarded_at = coalesce(public.profiles.onboarded_at, excluded.onboarded_at)
  returning * into v_after;

  -- terms_agreements는 profiles FK를 가지므로 프로필 다음에 기록한다
  insert into public.terms_agreements (user_id, terms_code, version)
  select v_uid, code, version from public.current_terms where code = any (p_agreed_codes)
  on conflict (user_id, terms_code, version) do nothing;

  -- middleware가 DB 조회 없이 온보딩 여부를 알 수 있도록 claim에 반영(다음 토큰 갱신부터)
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('onboarded', true)
   where id = v_uid;

  perform app.write_audit('profile', v_uid::text, 'onboard', to_jsonb(v_before),
    to_jsonb(v_after) || jsonb_build_object('terms', p_agreed_codes));
  return v_after;
end;
$$;

-- ── 운영자 역할 지정(owner 전용) ─────────────────────────
-- 계정 생성은 서버(Admin API)가 하고, 역할 부여·회수와 감사는 이 함수가 한다.
create or replace function public.set_staff_role(
  p_user_id uuid,
  p_role text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_target auth.users;
  v_before_role text;
begin
  if not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner only';
  end if;
  if p_role is not null and p_role not in ('admin', 'owner') then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'role must be admin, owner or null';
  end if;
  if p_user_id = v_uid then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'cannot change own role';
  end if;

  select * into v_target from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if exists (select 1 from auth.identities where user_id = p_user_id and provider <> 'email') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'only email accounts can be staff';
  end if;

  v_before_role := v_target.raw_app_meta_data ->> 'role';
  if v_before_role = 'owner' and p_role is distinct from 'owner'
     and (select count(*) from auth.users where raw_app_meta_data ->> 'role' = 'owner') <= 1 then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'cannot remove the last owner';
  end if;

  update auth.users
     set raw_app_meta_data = case
           when p_role is null then coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
           else coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role)
         end
   where id = p_user_id;

  -- 배정·제안 FK 대상이 되도록 운영자도 profiles 행을 가진다(온보딩 대상 아님)
  insert into public.profiles (id, display_name)
  values (p_user_id, left(split_part(v_target.email, '@', 1), 50))
  on conflict (id) do nothing;

  -- 역할 변경은 즉시 반영되어야 하므로 기존 세션을 끊는다(리프레시 토큰 무효화).
  -- 이미 발급된 access token은 만료(jwt_expiry=900초)까지 유효하다(D-07).
  delete from auth.sessions where user_id = p_user_id;

  perform app.write_audit('staff', p_user_id::text, 'set_role',
    jsonb_build_object('role', v_before_role), jsonb_build_object('role', p_role, 'email', v_target.email));
end;
$$;

-- ── 운영자 목록(owner 전용) ───────────────────────────────
create or replace function public.list_staff()
returns table (
  id uuid, email text, role text, mfa_enabled boolean, password_change_required boolean,
  last_sign_in_at timestamptz, created_at timestamptz
)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner only';
  end if;
  return query
    select u.id, u.email::text, u.raw_app_meta_data ->> 'role',
           exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
           coalesce((u.raw_app_meta_data ->> 'password_change_required')::boolean, false),
           u.last_sign_in_at, u.created_at
      from auth.users u
     where u.raw_app_meta_data ->> 'role' in ('admin', 'owner')
     order by u.created_at;
end;
$$;

-- ── 인증 보안 이벤트 감사(본인 행위만) ─────────────────────
create or replace function public.record_auth_event(p_event text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
begin
  if p_event not in ('password_changed', 'mfa_enrolled', 'admin_signed_in') then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown auth event';
  end if;
  perform app.write_audit('auth_user', v_uid::text, p_event, null, null);
end;
$$;

revoke execute on function
  public.complete_onboarding(text, text[]), public.set_staff_role(uuid, text),
  public.list_staff(), public.record_auth_event(text)
from public, anon, service_role;
grant execute on function
  public.complete_onboarding(text, text[]), public.set_staff_role(uuid, text),
  public.list_staff(), public.record_auth_event(text)
to authenticated;

-- ── 최초 owner 지정(부트스트랩) ───────────────────────────
-- owner가 한 명도 없을 때만 동작한다. service_role 전용(scripts/seed-owner.ts).
create or replace function public.bootstrap_owner(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target auth.users;
begin
  perform pg_advisory_xact_lock(hashtextextended('bootstrap_owner', 0));
  if exists (select 1 from auth.users where raw_app_meta_data ->> 'role' = 'owner') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner already exists';
  end if;
  select * into v_target from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if exists (select 1 from auth.identities where user_id = p_user_id and provider <> 'email') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'only email accounts can be staff';
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"owner"}'::jsonb
   where id = p_user_id;
  insert into public.profiles (id, display_name)
  values (p_user_id, left(split_part(v_target.email, '@', 1), 50))
  on conflict (id) do nothing;

  perform app.write_audit('staff', p_user_id::text, 'bootstrap_owner', null,
    jsonb_build_object('role', 'owner', 'email', v_target.email));
end;
$$;
revoke execute on function public.bootstrap_owner(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(uuid) to service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000007', 'auth_onboarding');

-- ════════ 20261020000008_app_settings.sql ════════
-- Googolf M3: 운영 설정 플래그
-- D-42: SMS 대행사 계약 전까지 고객 휴대폰 인증을 끈다. 계약 후 phone_verification_required=true로 켠다.

create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
-- 화면 구성에 필요한 공개 설정만 담는다. 비밀값을 넣지 않는다.
grant select on public.app_settings to anon, authenticated;
create policy app_settings_select on public.app_settings for select to anon, authenticated using (true);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function app.set_updated_at();

insert into public.app_settings (key, value, description) values
  ('phone_verification_required', 'false', '고객 온보딩 시 휴대폰 OTP 인증 필수 여부(SMS 대행사 계약 후 true)');

create or replace function app.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = p_key), p_default);
$$;

-- 설정 변경(owner 전용, 감사 로그)
create or replace function public.set_app_setting(p_key text, p_value jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform app.require_admin();
  if not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner only';
  end if;
  select value into v_before from public.app_settings where key = p_key for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  update public.app_settings set value = p_value where key = p_key;
  perform app.write_audit('app_setting', p_key, 'update',
    jsonb_build_object('value', v_before), jsonb_build_object('value', p_value));
end;
$$;
revoke execute on function public.set_app_setting(text, jsonb) from public, anon, service_role;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;

-- 온보딩: 휴대폰 인증은 설정에 따라 필수/생략. 인증된 번호가 있으면 저장한다.
create or replace function public.complete_onboarding(
  p_display_name text,
  p_agreed_codes text[]
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
  v_user auth.users;
  v_phone_ok boolean;
  v_missing text;
  v_before public.profiles;
  v_after public.profiles;
begin
  if app.jwt_role() <> 'customer' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'staff accounts do not onboard';
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'kakao') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'kakao account required';
  end if;
  v_phone_ok := coalesce(v_user.phone, '') <> '' and v_user.phone_confirmed_at is not null;
  if app.setting_bool('phone_verification_required', true) and not v_phone_ok then
    raise exception 'phone_not_verified' using errcode = 'GB422';
  end if;

  p_display_name := nullif(trim(p_display_name), '');
  if p_display_name is null or char_length(p_display_name) > 50 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'display_name 1..50';
  end if;

  select string_agg(code, ',') into v_missing
    from public.current_terms
   where required and not (code = any (coalesce(p_agreed_codes, '{}')));
  if v_missing is not null then
    raise exception 'terms_required' using errcode = 'GB422', detail = v_missing;
  end if;

  select * into v_before from public.profiles where id = v_uid;

  insert into public.profiles (id, display_name, phone, phone_verified_at, onboarded_at)
  values (
    v_uid, p_display_name,
    case when v_phone_ok then '+' || ltrim(v_user.phone, '+') end,
    case when v_phone_ok then v_user.phone_confirmed_at end,
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    phone_verified_at = coalesce(excluded.phone_verified_at, public.profiles.phone_verified_at),
    onboarded_at = coalesce(public.profiles.onboarded_at, excluded.onboarded_at)
  returning * into v_after;

  insert into public.terms_agreements (user_id, terms_code, version)
  select v_uid, code, version from public.current_terms where code = any (p_agreed_codes)
  on conflict (user_id, terms_code, version) do nothing;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('onboarded', true)
   where id = v_uid;

  perform app.write_audit('profile', v_uid::text, 'onboard', to_jsonb(v_before),
    to_jsonb(v_after) || jsonb_build_object('terms', p_agreed_codes));
  return v_after;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000008', 'app_settings');

commit;

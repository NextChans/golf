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

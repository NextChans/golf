-- Googolf 운영 DB 스키마 일괄 적용 (자동 생성: node scripts/bundle-migrations.mjs --from 20261020000014)
-- 포함 마이그레이션: 20261020000014_community.sql
-- Supabase 대시보드 → SQL Editor → 새 쿼리에 전체를 붙여넣고 Run. 이미 적용된 버전은 다시 실행하지 말 것.
begin;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
-- 이미 적용된 마이그레이션이 하나라도 있으면 중단(이중 적용 방지)
do $$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version in ('20261020000014')) then
    raise exception '이미 적용된 마이그레이션이 있습니다. supabase_migrations.schema_migrations를 확인하세요.';
  end if;
end $$;

-- ════════ 20261020000014_community.sql ════════
-- Googolf M7: 골프 모임 커뮤니티(D-28, D-67~72)
-- 골프 관련 모임만 허용한다: 모임 유형 6개 중 하나 필수, 금칙어가 있으면 운영자 검수 대기(review)로 만든다.
-- 모든 변경은 아래 함수로만 한다(테이블 DML 권한 없음). 회원 연락처는 커뮤니티 어디에도 노출하지 않는다(닉네임만).

create type public.group_type as enum ('round', 'screen', 'practice', 'join', 'level', 'membership');
create type public.group_join_policy as enum ('open', 'approval');
create type public.group_status as enum ('active', 'review', 'hidden', 'closed');
create type public.group_role as enum ('owner', 'manager', 'member');
create type public.group_member_status as enum ('pending', 'active', 'banned');
create type public.meeting_status as enum ('scheduled', 'cancelled');
create type public.report_target as enum ('group', 'post', 'user');
create type public.report_reason as enum ('not_golf', 'spam', 'abuse', 'illegal', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ── 테이블 ───────────────────────────────────────────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  type public.group_type not null,
  region public.region not null,
  description text not null check (char_length(description) between 10 and 2000),
  join_policy public.group_join_policy not null default 'approval',
  capacity integer not null default 100 check (capacity between 2 and 300),
  open_chat_url text check (open_chat_url ~ '^https://open\.kakao\.com/'),
  status public.group_status not null default 'active',
  status_reason text check (char_length(status_reason) <= 300),
  owner_id uuid not null references public.profiles (id),
  member_count integer not null default 1 check (member_count >= 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groups_list_idx on public.groups (status, region, type, created_at desc);

-- display_name은 가입 시점의 닉네임 스냅샷(회원 목록·게시글 작성자 표시용, profiles를 노출하지 않기 위함)
create table public.group_members (
  group_id uuid not null references public.groups (id),
  user_id uuid not null references public.profiles (id),
  role public.group_role not null default 'member',
  status public.group_member_status not null default 'pending',
  display_name text not null check (char_length(display_name) between 1 and 50),
  join_message text check (char_length(join_message) <= 200),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id, status);
-- 모임당 모임장은 정확히 1명(활성)
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';

create table public.group_meetings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id),
  title text not null check (char_length(title) between 2 and 60),
  starts_at timestamptz not null,
  golf_course_id uuid references public.golf_courses (id),
  place_free text check (char_length(place_free) between 1 and 100),
  capacity integer not null check (capacity between 2 and 100),
  fee_per_person bigint check (fee_per_person >= 0),
  note text check (char_length(note) <= 1000),
  status public.meeting_status not null default 'scheduled',
  attendee_count integer not null default 0 check (attendee_count >= 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_place_xor check ((golf_course_id is null) <> (place_free is null))
);
create index group_meetings_group_idx on public.group_meetings (group_id, starts_at);

create table public.meeting_attendees (
  meeting_id uuid not null references public.group_meetings (id),
  user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
create index meeting_attendees_user_idx on public.meeting_attendees (user_id);

create table public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id),
  author_id uuid not null references public.profiles (id),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 5000),
  is_notice boolean not null default false,
  is_pinned boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index group_posts_group_idx on public.group_posts (group_id, is_pinned desc, created_at desc) where status = 'active';

create table public.community_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id),
  target_type public.report_target not null,
  target_id uuid not null,
  group_id uuid references public.groups (id),
  reason public.report_reason not null,
  detail text check (char_length(detail) <= 500),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
-- 같은 사람이 같은 대상을 중복 신고하지 못한다(열린 신고 기준)
create unique index community_reports_once on public.community_reports (reporter_id, target_type, target_id) where status = 'open';
create index community_reports_open_idx on public.community_reports (status, created_at desc);

create trigger groups_updated_at before update on public.groups for each row execute function app.set_updated_at();
create trigger group_meetings_updated_at before update on public.group_meetings for each row execute function app.set_updated_at();
create trigger group_posts_updated_at before update on public.group_posts for each row execute function app.set_updated_at();

-- ── 헬퍼 ─────────────────────────────────────────────────
-- 골프 외 모임 의심 금칙어(D-68). 걸리면 review로 만들어 운영자가 확인한다(차단이 아니라 보류)
create or replace function app.community_flagged(p_text text) returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(p_text, '') ~* '(소개팅|미팅|술자리|술모임|번개팅|헌팅|재테크|코인|투자방|리딩방|대리\s*부킹|부킹\s*판매|양도\s*판매|도박|성인)';
$$;

-- RLS용: 가입 대기 포함 참여자 여부(강퇴 제외). 비공개·검수 대기 모임도 참여자는 본다
create or replace function app.is_group_participant(p_group_id uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members
                  where group_id = p_group_id and user_id = auth.uid() and status <> 'banned');
$$;

-- 현재 사용자의 모임 내 활성 멤버십(없으면 null)
create or replace function app.group_role_of(p_group_id uuid) returns public.group_role
language sql stable
security definer
set search_path = ''
as $$
  select role from public.group_members
   where group_id = p_group_id and user_id = auth.uid() and status = 'active';
$$;

-- RLS용: 활성 멤버 여부(정책에서 (select ...)로 감싸 쓴다)
create or replace function app.is_group_member(p_group_id uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members
                  where group_id = p_group_id and user_id = auth.uid() and status = 'active');
$$;

create or replace function app.lock_group(p_group_id uuid) returns public.groups
language plpgsql
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  select * into v_group from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  return v_group;
end;
$$;

-- 모임장·운영진 권한 확인(활성 모임만)
create or replace function app.require_group_manager(p_group public.groups) returns public.group_role
language plpgsql stable
set search_path = ''
as $$
declare
  v_role public.group_role := app.group_role_of(p_group.id);
begin
  if v_role is null or v_role = 'member' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'group owner or manager only';
  end if;
  if p_group.status not in ('active', 'review') then
    perform app.invalid_state(p_group.status::text, 'manage group');
  end if;
  return v_role;
end;
$$;

create or replace function app.group_payload(p_group public.groups) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object('group_id', p_group.id, 'group_name', p_group.name);
$$;

-- ── 모임 개설 (온보딩 고객, 멱등, 모임장 1인당 활성 모임 3개) ──
create or replace function public.create_group(
  p_idempotency_key uuid,
  p_name text,
  p_type public.group_type,
  p_region public.region,
  p_description text,
  p_join_policy public.group_join_policy,
  p_capacity integer,
  p_open_chat_url text
) returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_cached jsonb;
  v_group public.groups;
  v_flagged boolean;
  v_name text := trim(p_name);
  v_desc text := trim(p_description);
begin
  v_cached := app.idempotency_begin(p_idempotency_key, 'create_group', md5(jsonb_build_object(
    'n', p_name, 't', p_type, 'r', p_region, 'd', p_description, 'j', p_join_policy, 'c', p_capacity, 'o', p_open_chat_url)::text));
  if v_cached is not null then
    return jsonb_populate_record(null::public.groups, v_cached);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('group-owner:' || v_uid::text, 0));
  if (select count(*) from public.groups where owner_id = v_uid and status <> 'closed') >= 3 then
    raise exception 'limit_exceeded' using errcode = 'GB422', detail = 'owner can run up to 3 groups';
  end if;
  if (select count(*) from public.group_members where user_id = v_uid and status = 'active') >= 10 then
    raise exception 'limit_exceeded' using errcode = 'GB422', detail = 'member of up to 10 groups';
  end if;

  v_flagged := app.community_flagged(v_name) or app.community_flagged(v_desc);
  begin
    insert into public.groups (name, type, region, description, join_policy, capacity, open_chat_url, status, status_reason, owner_id)
    values (v_name, p_type, p_region, v_desc, coalesce(p_join_policy, 'approval'), coalesce(p_capacity, 100),
            nullif(trim(p_open_chat_url), ''),
            case when v_flagged then 'review'::public.group_status else 'active'::public.group_status end,
            case when v_flagged then '금칙어 자동 보류' end, v_uid)
    returning * into v_group;
  exception when check_violation or not_null_violation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  insert into public.group_members (group_id, user_id, role, status, display_name, joined_at)
  select v_group.id, v_uid, 'owner', 'active', coalesce(p.display_name, '모임장'), now()
    from public.profiles p where p.id = v_uid;

  perform app.write_audit('group', v_group.id::text, 'create', null, to_jsonb(v_group));
  if v_flagged then
    perform app.enqueue_notification('community.review', 'admins', null, 'ADMIN_GROUP_REVIEW',
      app.group_payload(v_group), format('group:%s:review', v_group.id));
  end if;
  perform app.idempotency_finish(p_idempotency_key, to_jsonb(v_group));
  return v_group;
end;
$$;

-- ── 모임 정보 수정 (모임장·운영진) ─────────────────────────
create or replace function public.update_group(
  p_group_id uuid,
  p_expected_version integer,
  p_name text,
  p_region public.region,
  p_description text,
  p_join_policy public.group_join_policy,
  p_capacity integer,
  p_open_chat_url text
) returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.groups;
  v_after public.groups;
  v_flagged boolean;
begin
  perform app.require_customer();
  v_before := app.lock_group(p_group_id);
  perform app.require_group_manager(v_before);
  if v_before.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'GB409';
  end if;
  if p_capacity < v_before.member_count then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'capacity below current members';
  end if;
  v_flagged := app.community_flagged(p_name) or app.community_flagged(p_description);
  begin
    update public.groups set
      name = trim(p_name), region = p_region, description = trim(p_description),
      join_policy = p_join_policy, capacity = p_capacity, open_chat_url = nullif(trim(p_open_chat_url), ''),
      -- 수정으로 금칙어가 생기면 검수 대기로 돌린다(운영자가 숨긴 모임은 그대로)
      status = case when v_flagged and status = 'active' then 'review'::public.group_status else status end,
      status_reason = case when v_flagged and status = 'active' then '금칙어 자동 보류' else status_reason end,
      version = version + 1
    where id = p_group_id returning * into v_after;
  exception when check_violation or not_null_violation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;
  perform app.write_audit('group', p_group_id::text, 'update', to_jsonb(v_before), to_jsonb(v_after));
  if v_after.status = 'review' and v_before.status = 'active' then
    perform app.enqueue_notification('community.review', 'admins', null, 'ADMIN_GROUP_REVIEW',
      app.group_payload(v_after), format('group:%s:review:v%s', v_after.id, v_after.version));
  end if;
  return v_after;
end;
$$;

-- ── 가입 신청 (공개: 즉시 가입, 승인제: 대기) ──────────────
create or replace function public.join_group(p_group_id uuid, p_message text default null)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_group public.groups;
  v_existing public.group_members;
  v_member public.group_members;
begin
  v_group := app.lock_group(p_group_id);
  if v_group.status <> 'active' then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  select * into v_existing from public.group_members where group_id = p_group_id and user_id = v_uid;
  if found then
    if v_existing.status = 'banned' then
      raise exception 'forbidden' using errcode = 'GB403', detail = 'banned from group';
    end if;
    return v_existing; -- 이미 가입·대기 중이면 그대로(멱등)
  end if;
  if (select count(*) from public.group_members where user_id = v_uid and status = 'active') >= 10 then
    raise exception 'limit_exceeded' using errcode = 'GB422', detail = 'member of up to 10 groups';
  end if;
  if v_group.join_policy = 'open' and v_group.member_count >= v_group.capacity then
    raise exception 'group_full' using errcode = 'GB409';
  end if;

  insert into public.group_members (group_id, user_id, role, status, display_name, join_message, joined_at)
  select p_group_id, v_uid, 'member',
         case when v_group.join_policy = 'open' then 'active'::public.group_member_status else 'pending'::public.group_member_status end,
         coalesce(p.display_name, '회원'), left(nullif(trim(p_message), ''), 200),
         case when v_group.join_policy = 'open' then now() end
    from public.profiles p where p.id = v_uid
  returning * into v_member;

  if v_member.status = 'active' then
    update public.groups set member_count = member_count + 1 where id = p_group_id;
  end if;
  perform app.write_audit('group_member', p_group_id::text || ':' || v_uid::text, 'join', null, to_jsonb(v_member));
  return v_member;
end;
$$;

-- ── 가입 승인·거절 (모임장·운영진) ─────────────────────────
create or replace function public.decide_join(p_group_id uuid, p_user_id uuid, p_approve boolean)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_before public.group_members;
  v_after public.group_members;
begin
  perform app.require_customer();
  v_group := app.lock_group(p_group_id);
  perform app.require_group_manager(v_group);
  select * into v_before from public.group_members where group_id = p_group_id and user_id = p_user_id for update;
  if not found or v_before.status <> 'pending' then
    raise exception 'invalid_state' using errcode = 'GB409', detail = 'not a pending member';
  end if;

  if p_approve then
    if v_group.member_count >= v_group.capacity then
      raise exception 'group_full' using errcode = 'GB409';
    end if;
    update public.group_members set status = 'active', joined_at = now()
     where group_id = p_group_id and user_id = p_user_id returning * into v_after;
    update public.groups set member_count = member_count + 1 where id = p_group_id;
    perform app.enqueue_notification('community.join_approved', 'customer', p_user_id, 'GROUP_JOIN_APPROVED',
      app.group_payload(v_group), format('group:%s:member:%s:approved:%s', p_group_id, p_user_id, extract(epoch from now())::bigint));
  else
    delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  end if;
  perform app.write_audit('group_member', p_group_id::text || ':' || p_user_id::text,
    case when p_approve then 'approve' else 'reject' end, to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- 모임장이 떠날 때 승계: 운영진 중 가장 먼저 가입한 사람 → 멤버 중 가장 먼저 가입한 사람 → 없으면 모임 종료
create or replace function app.succeed_owner(p_group public.groups) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_next uuid;
begin
  select user_id into v_next from public.group_members
   where group_id = p_group.id and status = 'active' and role <> 'owner'
   order by (role = 'manager') desc, joined_at, user_id
   limit 1;
  if v_next is null then
    update public.groups set status = 'closed', status_reason = '멤버 없음', owner_id = owner_id where id = p_group.id;
    return null;
  end if;
  update public.group_members set role = 'owner' where group_id = p_group.id and user_id = v_next;
  update public.groups set owner_id = v_next where id = p_group.id;
  return v_next;
end;
$$;

-- ── 탈퇴(본인). 모임장이면 자동 승계 ────────────────────────
create or replace function public.leave_group(p_group_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_group public.groups;
  v_member public.group_members;
  v_next uuid;
begin
  v_group := app.lock_group(p_group_id);
  select * into v_member from public.group_members where group_id = p_group_id and user_id = v_uid for update;
  if not found or v_member.status = 'banned' then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
  if v_member.status = 'active' then
    update public.groups set member_count = greatest(member_count - 1, 0) where id = p_group_id;
    -- 앞으로 열릴 정모 참석도 함께 취소한다
    with gone as (
      delete from public.meeting_attendees a using public.group_meetings m
       where a.meeting_id = m.id and m.group_id = p_group_id and a.user_id = v_uid
         and m.status = 'scheduled' and m.starts_at > now()
      returning a.meeting_id
    )
    update public.group_meetings m set attendee_count = greatest(attendee_count - 1, 0)
      from gone where m.id = gone.meeting_id;
  end if;
  if v_member.role = 'owner' then
    v_next := app.succeed_owner(v_group);
  end if;
  perform app.write_audit('group_member', p_group_id::text || ':' || v_uid::text, 'leave', to_jsonb(v_member),
    jsonb_build_object('new_owner', v_next));
end;
$$;

-- ── 강퇴(재가입 불가)·차단 해제 ─────────────────────────────
-- 운영진은 일반 멤버만 강퇴할 수 있고, 모임장은 운영진까지 강퇴할 수 있다
create or replace function public.kick_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_my_role public.group_role;
  v_target public.group_members;
begin
  perform app.require_customer();
  v_group := app.lock_group(p_group_id);
  v_my_role := app.require_group_manager(v_group);
  select * into v_target from public.group_members where group_id = p_group_id and user_id = p_user_id for update;
  if not found or v_target.status = 'banned' then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_target.role = 'owner' or (v_target.role = 'manager' and v_my_role <> 'owner') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'cannot kick this member';
  end if;
  update public.group_members set status = 'banned', role = 'member' where group_id = p_group_id and user_id = p_user_id;
  if v_target.status = 'active' then
    update public.groups set member_count = greatest(member_count - 1, 0) where id = p_group_id;
    with gone as (
      delete from public.meeting_attendees a using public.group_meetings m
       where a.meeting_id = m.id and m.group_id = p_group_id and a.user_id = p_user_id
         and m.status = 'scheduled' and m.starts_at > now()
      returning a.meeting_id
    )
    update public.group_meetings m set attendee_count = greatest(attendee_count - 1, 0)
      from gone where m.id = gone.meeting_id;
  end if;
  perform app.write_audit('group_member', p_group_id::text || ':' || p_user_id::text, 'kick', to_jsonb(v_target), null);
end;
$$;

create or replace function public.unban_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  perform app.require_customer();
  v_group := app.lock_group(p_group_id);
  if app.require_group_manager(v_group) <> 'owner' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner only';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = p_user_id and status = 'banned';
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  perform app.write_audit('group_member', p_group_id::text || ':' || p_user_id::text, 'unban', null, null);
end;
$$;

-- ── 역할 변경·모임장 위임 (모임장만) ────────────────────────
create or replace function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role public.group_role) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_group public.groups;
  v_target public.group_members;
begin
  v_group := app.lock_group(p_group_id);
  if app.require_group_manager(v_group) <> 'owner' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner only';
  end if;
  select * into v_target from public.group_members
   where group_id = p_group_id and user_id = p_user_id and status = 'active' for update;
  if not found or p_user_id = v_uid then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'target must be another active member';
  end if;

  if p_role = 'owner' then
    -- 위임: 기존 모임장은 운영진으로(고유 인덱스 때문에 먼저 내린다)
    update public.group_members set role = 'manager' where group_id = p_group_id and user_id = v_uid;
    update public.group_members set role = 'owner' where group_id = p_group_id and user_id = p_user_id;
    update public.groups set owner_id = p_user_id, version = version + 1 where id = p_group_id;
  else
    update public.group_members set role = p_role where group_id = p_group_id and user_id = p_user_id;
  end if;
  perform app.write_audit('group_member', p_group_id::text || ':' || p_user_id::text, 'set_role',
    jsonb_build_object('role', v_target.role), jsonb_build_object('role', p_role));
end;
$$;

-- ── 정모(라운딩) ─────────────────────────────────────────
create or replace function public.create_meeting(
  p_group_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_golf_course_id uuid,
  p_place_free text,
  p_capacity integer,
  p_fee_per_person bigint,
  p_note text
) returns public.group_meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_group public.groups;
  v_meeting public.group_meetings;
begin
  v_group := app.lock_group(p_group_id);
  perform app.require_group_manager(v_group);
  if v_group.status <> 'active' then
    perform app.invalid_state(v_group.status::text, 'create meeting');
  end if;
  if p_starts_at is null or p_starts_at <= now() or p_starts_at > now() + interval '180 days' then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'starts_at must be within 180 days';
  end if;
  if p_golf_course_id is not null then
    perform 1 from public.golf_courses where id = p_golf_course_id and is_active;
    if not found then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown golf course';
    end if;
  end if;
  begin
    insert into public.group_meetings (group_id, title, starts_at, golf_course_id, place_free, capacity, fee_per_person, note, created_by)
    values (p_group_id, trim(p_title), p_starts_at, p_golf_course_id, nullif(trim(p_place_free), ''), p_capacity,
            p_fee_per_person, nullif(trim(p_note), ''), v_uid)
    returning * into v_meeting;
  exception when check_violation or not_null_violation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  -- 만든 사람은 자동 참석
  insert into public.meeting_attendees (meeting_id, user_id) values (v_meeting.id, v_uid);
  update public.group_meetings set attendee_count = 1 where id = v_meeting.id returning * into v_meeting;

  -- 활성 멤버(만든 사람 제외)에게 정모 개설 알림
  perform app.enqueue_notification('community.meeting_created', 'customer', m.user_id, 'GROUP_MEETING_CREATED',
            app.group_payload(v_group) || jsonb_build_object('meeting_id', v_meeting.id, 'title', v_meeting.title, 'starts_at', v_meeting.starts_at),
            format('meeting:%s:created:%s', v_meeting.id, m.user_id))
    from public.group_members m
   where m.group_id = p_group_id and m.status = 'active' and m.user_id <> v_uid;

  perform app.write_audit('group_meeting', v_meeting.id::text, 'create', null, to_jsonb(v_meeting));
  return v_meeting;
end;
$$;

-- 참석·취소: 정모 행을 잠가 정원 경쟁을 직렬화한다(잠금 순서: group_meetings → meeting_attendees)
create or replace function public.attend_meeting(p_meeting_id uuid) returns public.group_meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_meeting public.group_meetings;
begin
  select * into v_meeting from public.group_meetings where id = p_meeting_id for update;
  if not found or not app.is_group_member(v_meeting.group_id) then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_meeting.status <> 'scheduled' or v_meeting.starts_at <= now() then
    perform app.invalid_state(v_meeting.status::text, 'attend');
  end if;
  perform 1 from public.meeting_attendees where meeting_id = p_meeting_id and user_id = v_uid;
  if found then
    return v_meeting; -- 이미 참석(멱등)
  end if;
  if v_meeting.attendee_count >= v_meeting.capacity then
    raise exception 'meeting_full' using errcode = 'GB409';
  end if;
  insert into public.meeting_attendees (meeting_id, user_id) values (p_meeting_id, v_uid);
  update public.group_meetings set attendee_count = attendee_count + 1 where id = p_meeting_id returning * into v_meeting;
  perform app.write_audit('meeting_attendee', p_meeting_id::text || ':' || v_uid::text, 'attend', null, null);
  return v_meeting;
end;
$$;

create or replace function public.cancel_attendance(p_meeting_id uuid) returns public.group_meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_meeting public.group_meetings;
begin
  select * into v_meeting from public.group_meetings where id = p_meeting_id for update;
  if not found or not app.is_group_member(v_meeting.group_id) then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_meeting.status <> 'scheduled' or v_meeting.starts_at <= now() then
    perform app.invalid_state(v_meeting.status::text, 'cancel attendance');
  end if;
  delete from public.meeting_attendees where meeting_id = p_meeting_id and user_id = v_uid;
  if not found then
    return v_meeting;
  end if;
  update public.group_meetings set attendee_count = greatest(attendee_count - 1, 0) where id = p_meeting_id returning * into v_meeting;
  perform app.write_audit('meeting_attendee', p_meeting_id::text || ':' || v_uid::text, 'cancel', null, null);
  return v_meeting;
end;
$$;

create or replace function public.cancel_meeting(p_meeting_id uuid, p_reason text) returns public.group_meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_group public.groups;
  v_before public.group_meetings;
  v_after public.group_meetings;
begin
  select * into v_before from public.group_meetings where id = p_meeting_id;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  v_group := app.lock_group(v_before.group_id);   -- 잠금 순서: groups → group_meetings
  perform app.require_group_manager(v_group);
  select * into v_before from public.group_meetings where id = p_meeting_id for update;
  if v_before.status <> 'scheduled' then
    perform app.invalid_state(v_before.status::text, 'cancel meeting');
  end if;
  update public.group_meetings set status = 'cancelled', note = coalesce(note, '') ||
         case when nullif(trim(p_reason), '') is null then '' else E'\n[취소 사유] ' || left(trim(p_reason), 300) end
   where id = p_meeting_id returning * into v_after;

  perform app.enqueue_notification('community.meeting_cancelled', 'customer', a.user_id, 'GROUP_MEETING_CANCELLED',
            app.group_payload(v_group) || jsonb_build_object('meeting_id', v_after.id, 'title', v_after.title, 'starts_at', v_after.starts_at),
            format('meeting:%s:cancelled:%s', v_after.id, a.user_id))
    from public.meeting_attendees a
   where a.meeting_id = p_meeting_id and a.user_id <> v_uid;
  perform app.write_audit('group_meeting', p_meeting_id::text, 'cancel', to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 게시글 (멤버 작성, 공지·고정은 모임장·운영진) ──────────
create or replace function public.create_post(p_group_id uuid, p_title text, p_body text, p_is_notice boolean)
returns public.group_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_role public.group_role;
  v_group public.groups;
  v_post public.group_posts;
begin
  select * into v_group from public.groups where id = p_group_id;
  v_role := app.group_role_of(p_group_id);
  if v_group.id is null or v_role is null then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_group.status not in ('active', 'review') then
    perform app.invalid_state(v_group.status::text, 'post');
  end if;
  if coalesce(p_is_notice, false) and v_role = 'member' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'notice is for owner or manager';
  end if;
  -- 도배 방지: 10분에 10건
  perform pg_advisory_xact_lock(hashtextextended('post:' || v_uid::text, 0));
  if (select count(*) from public.group_posts where author_id = v_uid and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'rate_limited' using errcode = 'GB429';
  end if;
  begin
    insert into public.group_posts (group_id, author_id, title, body, is_notice, is_pinned)
    values (p_group_id, v_uid, trim(p_title), trim(p_body), coalesce(p_is_notice, false), coalesce(p_is_notice, false))
    returning * into v_post;
  exception when check_violation or not_null_violation then
    raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;
  perform app.write_audit('group_post', v_post.id::text, 'create', null, jsonb_build_object('group_id', p_group_id, 'is_notice', v_post.is_notice));
  return v_post;
end;
$$;

create or replace function public.delete_post(p_post_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_post public.group_posts;
  v_role public.group_role;
begin
  select * into v_post from public.group_posts where id = p_post_id and status <> 'deleted' for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  v_role := app.group_role_of(v_post.group_id);
  if v_role is null or (v_post.author_id <> v_uid and v_role = 'member') then
    raise exception 'forbidden' using errcode = 'GB403';
  end if;
  update public.group_posts set status = 'deleted', is_pinned = false where id = p_post_id;
  perform app.write_audit('group_post', p_post_id::text, 'delete', jsonb_build_object('title', v_post.title, 'author_id', v_post.author_id), null);
end;
$$;

create or replace function public.set_post_pinned(p_post_id uuid, p_pinned boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.group_posts;
  v_group public.groups;
begin
  perform app.require_customer();
  select * into v_post from public.group_posts where id = p_post_id and status = 'active';
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  v_group := app.lock_group(v_post.group_id);
  perform app.require_group_manager(v_group);
  update public.group_posts set is_pinned = coalesce(p_pinned, false) where id = p_post_id;
  perform app.write_audit('group_post', p_post_id::text, case when p_pinned then 'pin' else 'unpin' end, null, null);
end;
$$;

-- ── 신고 (온보딩 고객) — 열린 신고 3건이면 모임·게시글 자동 비노출 ──
create or replace function public.report_content(
  p_target_type public.report_target, p_target_id uuid, p_reason public.report_reason, p_detail text
) returns public.community_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_group_id uuid;
  v_report public.community_reports;
  v_open integer;
begin
  if p_target_type = 'group' then
    select id into v_group_id from public.groups where id = p_target_id and status in ('active', 'review');
  elsif p_target_type = 'post' then
    select group_id into v_group_id from public.group_posts where id = p_target_id and status = 'active';
    if v_group_id is not null and not app.is_group_member(v_group_id) then
      v_group_id := null;
    end if;
  else
    -- 회원 신고는 같은 모임에서 활동 중인 회원만(닉네임으로 본 사람)
    select a.group_id into v_group_id from public.group_members a
      join public.group_members b on b.group_id = a.group_id and b.user_id = v_uid and b.status = 'active'
     where a.user_id = p_target_id and a.status in ('active', 'pending') limit 1;
  end if;
  if v_group_id is null or (p_target_type = 'user' and p_target_id = v_uid) then
    raise exception 'not_found' using errcode = 'GB404';
  end if;

  begin
    insert into public.community_reports (reporter_id, target_type, target_id, group_id, reason, detail)
    values (v_uid, p_target_type, p_target_id, v_group_id, p_reason, nullif(left(trim(p_detail), 500), ''))
    returning * into v_report;
  exception when unique_violation then
    raise exception 'duplicate_report' using errcode = 'GB409';
  end;

  select count(*) into v_open from public.community_reports
   where target_type = p_target_type and target_id = p_target_id and status = 'open';
  if v_open >= 3 then
    if p_target_type = 'group' then
      update public.groups set status = 'hidden', status_reason = '신고 누적 자동 비노출'
       where id = p_target_id and status in ('active', 'review');
    elsif p_target_type = 'post' then
      update public.group_posts set status = 'hidden', is_pinned = false where id = p_target_id and status = 'active';
    end if;
  end if;

  perform app.write_audit('community_report', v_report.id::text, 'create', null, to_jsonb(v_report));
  perform app.enqueue_notification('community.reported', 'admins', null, 'ADMIN_COMMUNITY_REPORTED',
    jsonb_build_object('report_id', v_report.id, 'target_type', p_target_type, 'reason', p_reason, 'open_count', v_open),
    format('report:%s', v_report.id));
  return v_report;
end;
$$;

-- ── 운영자: 모임 상태(검수 통과·비노출·복구), 게시글 비노출, 신고 처리 ──
create or replace function public.moderate_group(p_group_id uuid, p_status public.group_status, p_reason text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.groups;
  v_after public.groups;
begin
  perform app.require_admin();
  if p_status not in ('active', 'hidden') then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'active or hidden only';
  end if;
  v_before := app.lock_group(p_group_id);
  if v_before.status = 'closed' then
    perform app.invalid_state('closed', 'moderate');
  end if;
  update public.groups set status = p_status, status_reason = left(nullif(trim(p_reason), ''), 300), version = version + 1
   where id = p_group_id returning * into v_after;
  perform app.write_audit('group', p_group_id::text, 'moderate', to_jsonb(v_before), to_jsonb(v_after));
  if p_status = 'hidden' then
    perform app.enqueue_notification('community.group_hidden', 'customer', v_after.owner_id, 'GROUP_HIDDEN',
      app.group_payload(v_after) || jsonb_build_object('reason', v_after.status_reason),
      format('group:%s:hidden:v%s', v_after.id, v_after.version));
  end if;
  return v_after;
end;
$$;

create or replace function public.moderate_post(p_post_id uuid, p_hidden boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.group_posts;
begin
  perform app.require_admin();
  select * into v_before from public.group_posts where id = p_post_id and status <> 'deleted' for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  update public.group_posts set status = case when p_hidden then 'hidden' else 'active' end,
         is_pinned = case when p_hidden then false else is_pinned end
   where id = p_post_id;
  perform app.write_audit('group_post', p_post_id::text, case when p_hidden then 'hide' else 'restore' end,
    jsonb_build_object('status', v_before.status), null);
end;
$$;

create or replace function public.resolve_report(p_report_id bigint, p_status public.report_status) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_before public.community_reports;
begin
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid_input' using errcode = 'GB422';
  end if;
  select * into v_before from public.community_reports where id = p_report_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  if v_before.status <> 'open' then
    perform app.invalid_state(v_before.status::text, 'resolve');
  end if;
  -- 같은 대상의 열린 신고를 함께 처리한다
  update public.community_reports set status = p_status, resolved_by = v_uid, resolved_at = now()
   where target_type = v_before.target_type and target_id = v_before.target_id and status = 'open';
  perform app.write_audit('community_report', p_report_id::text, p_status::text, to_jsonb(v_before), null);
end;
$$;

-- ── RLS: 조회만 허용, 쓰기는 위 함수만 ─────────────────────
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.group_posts enable row level security;
alter table public.community_reports enable row level security;

revoke all on public.groups, public.group_members, public.group_meetings, public.meeting_attendees,
  public.group_posts, public.community_reports from anon, authenticated, service_role;
grant select on public.groups to anon, authenticated;
grant select on public.group_members, public.group_meetings, public.meeting_attendees,
  public.group_posts, public.community_reports to authenticated;

-- 모임: 활성 모임은 누구나(탐색), 그 외 상태는 멤버(대기 포함)·운영자
create policy groups_select on public.groups for select to anon, authenticated
  using (status = 'active' or (select app.is_admin()) or app.is_group_participant(id));
-- 멤버 목록: 같은 모임 활성 멤버, 본인 행, 운영자
create policy group_members_select on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_admin()) or app.is_group_member(group_id));
create policy group_meetings_select on public.group_meetings for select to authenticated
  using ((select app.is_admin()) or app.is_group_member(group_id));
create policy meeting_attendees_select on public.meeting_attendees for select to authenticated
  using ((select app.is_admin()) or exists (
    select 1 from public.group_meetings m where m.id = meeting_id and app.is_group_member(m.group_id)));
-- 게시글: 멤버는 활성 글, 운영자는 비노출 글까지
create policy group_posts_select on public.group_posts for select to authenticated
  using ((select app.is_admin()) or (status = 'active' and app.is_group_member(group_id)));
create policy community_reports_select on public.community_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select app.is_admin()));

revoke execute on function
  public.create_group(uuid, text, public.group_type, public.region, text, public.group_join_policy, integer, text),
  public.update_group(uuid, integer, text, public.region, text, public.group_join_policy, integer, text),
  public.join_group(uuid, text), public.decide_join(uuid, uuid, boolean), public.leave_group(uuid),
  public.kick_member(uuid, uuid), public.unban_member(uuid, uuid), public.set_member_role(uuid, uuid, public.group_role),
  public.create_meeting(uuid, text, timestamptz, uuid, text, integer, bigint, text),
  public.attend_meeting(uuid), public.cancel_attendance(uuid), public.cancel_meeting(uuid, text),
  public.create_post(uuid, text, text, boolean), public.delete_post(uuid), public.set_post_pinned(uuid, boolean),
  public.report_content(public.report_target, uuid, public.report_reason, text),
  public.moderate_group(uuid, public.group_status, text), public.moderate_post(uuid, boolean),
  public.resolve_report(bigint, public.report_status)
from public, anon, service_role;
grant execute on function
  public.create_group(uuid, text, public.group_type, public.region, text, public.group_join_policy, integer, text),
  public.update_group(uuid, integer, text, public.region, text, public.group_join_policy, integer, text),
  public.join_group(uuid, text), public.decide_join(uuid, uuid, boolean), public.leave_group(uuid),
  public.kick_member(uuid, uuid), public.unban_member(uuid, uuid), public.set_member_role(uuid, uuid, public.group_role),
  public.create_meeting(uuid, text, timestamptz, uuid, text, integer, bigint, text),
  public.attend_meeting(uuid), public.cancel_attendance(uuid), public.cancel_meeting(uuid, text),
  public.create_post(uuid, text, text, boolean), public.delete_post(uuid), public.set_post_pinned(uuid, boolean),
  public.report_content(public.report_target, uuid, public.report_reason, text),
  public.moderate_group(uuid, public.group_status, text), public.moderate_post(uuid, boolean),
  public.resolve_report(bigint, public.report_status)
to authenticated;
revoke execute on function app.is_group_member(uuid), app.is_group_participant(uuid), app.group_role_of(uuid) from public;
grant execute on function app.is_group_member(uuid), app.is_group_participant(uuid), app.group_role_of(uuid) to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000014', 'community');

commit;

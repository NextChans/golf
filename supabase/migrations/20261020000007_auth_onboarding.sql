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

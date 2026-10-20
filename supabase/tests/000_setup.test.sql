-- 테스트 헬퍼. 알파벳 순으로 가장 먼저 실행되며 의도적으로 커밋한다(tests 스키마는 로컬 DB에만 존재).
-- 다른 테스트 파일은 begin ... rollback 으로 감싼다.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- 테스트 사용자 생성: role은 app_metadata에, 온보딩 완료 프로필까지 만든다.
create or replace function tests.create_user(p_email text, p_role text default 'customer', p_onboarded boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    jsonb_build_object('provider', 'email', 'role', p_role), '{}'::jsonb, now(), now()
  );
  insert into public.profiles (id, display_name, phone, phone_verified_at, onboarded_at)
  values (v_id, split_part(p_email, '@', 1), '+821012345678',
          case when p_onboarded then now() end, case when p_onboarded then now() end);
  return v_id;
end;
$$;

create or replace function tests.user_role(p_user_id uuid) returns text
language sql stable
security definer
set search_path = ''
as $$
  select raw_app_meta_data ->> 'role' from auth.users where id = p_user_id;
$$;

create or replace function tests.user_app_metadata(p_user_id uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(raw_app_meta_data, '{}'::jsonb) from auth.users where id = p_user_id;
$$;

-- 카카오로 가입했고 아직 온보딩 전인 고객(프로필 없음). p_phone이 있으면 Auth에서 휴대폰 인증까지 끝난 상태.
create or replace function tests.create_kakao_user(p_email text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, phone, phone_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    p_phone, case when p_phone is not null then now() end,
    jsonb_build_object('provider', 'kakao', 'providers', jsonb_build_array('kakao')), '{}'::jsonb, now(), now()
  );
  insert into auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  values (v_id, 'kakao', 'kakao-' || v_id, jsonb_build_object('sub', 'kakao-' || v_id), now(), now());
  return v_id;
end;
$$;

-- 이메일 계정(운영자 후보). 역할 없음.
create or replace function tests.create_email_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now());
  insert into auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  values (v_id, 'email', v_id::text, jsonb_build_object('sub', v_id::text, 'email', p_email), now(), now());
  return v_id;
end;
$$;

-- PostgREST가 요청마다 설정하는 것과 같은 role/claims를 흉내낸다.
-- set_config('role')은 security definer 안에서 쓸 수 없어 invoker 함수로 둔다.
create or replace function tests.authenticate_as(p_user_id uuid, p_aal text default 'aal2')
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id, 'role', 'authenticated', 'aal', p_aal,
    'app_metadata', tests.user_app_metadata(p_user_id),
    -- user_metadata.role은 위조 시도용. 판별에 쓰이면 안 된다.
    'user_metadata', jsonb_build_object('role', 'owner')
  )::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.authenticate_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

-- 슈퍼유저로 돌아온다(검증 쿼리용).
create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

-- 고객 요청 생성 단축 헬퍼(현재 인증된 고객으로 호출)
create or replace function tests.new_booking(p_course uuid default '00000000-0000-4000-a000-000000000001')
returns public.booking_requests
language sql
set search_path = ''
as $$
  select * from public.create_booking_request(
    gen_random_uuid(), p_course, null, (now() at time zone 'Asia/Seoul')::date + 7,
    'part_1', null, null, 4, 200000, '테스트');
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();

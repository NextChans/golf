-- M2: owner의 운영자 역할 관리
begin;
select plan(13);

select tests.create_user('owner@test.local', 'owner') as owner \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
select tests.create_email_user('new@test.local') as new \gset
select tests.create_kakao_user('kakao@test.local', '821000000002') as kakao \gset

-- admin은 역할을 바꿀 수 없다
select tests.authenticate_as(:'admin');
select throws_ok(format($q$select public.set_staff_role(%L, 'admin')$q$, :'new'), 'GB403', 'forbidden', 'admin은 역할 지정 불가');
select throws_ok('select * from public.list_staff()', 'GB403', 'forbidden', 'admin은 운영자 목록 조회 불가');

-- owner도 aal1이면 불가
select tests.authenticate_as(:'owner', 'aal1');
select throws_ok(format($q$select public.set_staff_role(%L, 'admin')$q$, :'new'), 'GB403', 'forbidden', 'aal1 owner는 불가');

select tests.authenticate_as(:'owner');
select throws_ok(format($q$select public.set_staff_role(%L, 'admin')$q$, :'kakao'), 'GB403', 'forbidden', '카카오 계정은 운영자로 지정 불가');
select throws_ok(format($q$select public.set_staff_role(%L, 'superuser')$q$, :'new'), 'GB422', 'invalid_input', '알 수 없는 역할 거부');
select throws_ok(format($q$select public.set_staff_role(%L, null)$q$, :'owner'), 'GB403', 'forbidden', '자기 역할은 바꿀 수 없다');
select lives_ok(format($q$select public.set_staff_role(%L, 'admin')$q$, :'new'), '이메일 계정을 admin으로 지정');
-- 로컬 DB에 E2E가 만든 운영자가 남아 있을 수 있으므로 이 테스트가 만든 계정만 센다
select is((select count(*) from public.list_staff() where id in (:'owner', :'admin', :'new'))::int, 3, 'owner는 운영자 목록을 본다');

select tests.clear_authentication();
select is((select raw_app_meta_data ->> 'role' from auth.users where id = :'new'), 'admin', 'app_metadata.role 반영');
select isnt((select id from public.profiles where id = :'new'), null, '운영자 profiles 행 생성');
select is((select after ->> 'role' from public.audit_logs where entity_type = 'staff' and entity_id = :'new'), 'admin', '역할 변경 감사 로그');

-- 회수: role 제거 + 세션 종료
insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), :'new', now(), now());
select tests.authenticate_as(:'owner');
select public.set_staff_role(:'new', null);
select tests.clear_authentication();
select is((select raw_app_meta_data ? 'role' from auth.users where id = :'new'), false, '회수 시 role 제거');
select is((select count(*) from auth.sessions where user_id = :'new')::int, 0, '회수 시 세션 강제 종료');

select * from finish();
rollback;

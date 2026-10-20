-- M2: 최초 owner 부트스트랩(service_role 전용)
begin;
select plan(10);

-- E2E 실행으로 로컬 DB에 남은 owner를 무력화한다(rollback으로 복구).
update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where raw_app_meta_data ->> 'role' = 'owner';

select tests.create_user('customer@test.local') as customer \gset
select tests.create_user('owner@test.local', 'owner') as owner \gset
select tests.create_email_user('first@test.local') as first \gset
select tests.create_email_user('second@test.local') as second \gset
select tests.create_kakao_user('kakao@test.local', '821000000003') as kakao \gset

-- authenticated/anon은 실행 권한이 없다
select tests.authenticate_as(:'customer');
select throws_ok(format($q$select public.bootstrap_owner(%L)$q$, :'first'), '42501', null, 'authenticated 고객은 실행 불가');
select tests.authenticate_as(:'owner');
select throws_ok(format($q$select public.bootstrap_owner(%L)$q$, :'first'), '42501', null, 'owner 세션도 실행 불가');
select tests.authenticate_anon();
select throws_ok(format($q$select public.bootstrap_owner(%L)$q$, :'first'), '42501', null, 'anon은 실행 불가');

-- 권한 테스트용 owner를 제거해 owner가 없는 상태로 만든다
select tests.clear_authentication();
update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where id = :'owner';

set local role service_role;
select throws_ok(format($q$select public.bootstrap_owner(%L)$q$, gen_random_uuid()), 'GB404', 'not_found', '없는 사용자는 not_found');
select throws_ok(format($q$select public.bootstrap_owner(%L)$q$, :'kakao'), 'GB403', 'forbidden', '카카오 계정은 owner로 부트스트랩 불가');
select lives_ok(format($q$select public.bootstrap_owner(%L)$q$, :'first'), 'owner가 없으면 이메일 계정을 owner로 지정');
reset role;

select is((select raw_app_meta_data ->> 'role' from auth.users where id = :'first'::uuid), 'owner', 'app_metadata.role = owner');
select isnt((select id from public.profiles where id = :'first'::uuid), null, 'owner profiles 행 생성');
select is((select count(*) from public.audit_logs
            where entity_type = 'staff' and entity_id = :'first' and action = 'bootstrap_owner')::int,
          1, '부트스트랩 감사 로그');

-- owner가 이미 있으면 두 번째 호출은 거부
set local role service_role;
select throws_ok(format($q$select public.bootstrap_owner(%L)$q$, :'second'), 'GB403', 'forbidden', 'owner가 있으면 부트스트랩 불가');
reset role;

select * from finish();
rollback;

-- (d) audit_logs는 append-only: 모든 역할에서 수정·삭제 불가
begin;
select plan(8);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('owner@test.local', 'owner') as owner \gset
select tests.authenticate_as(:'a', 'aal1');
select tests.new_booking();

select tests.clear_authentication();
select ok((select count(*) from public.audit_logs) > 0, '감사 로그가 존재한다');

select tests.authenticate_as(:'a', 'aal1');
select throws_ok('update public.audit_logs set action = ''x''', '42501', null, '고객 update 불가');
select throws_ok('delete from public.audit_logs', '42501', null, '고객 delete 불가');

select tests.authenticate_as(:'owner');
select is((select count(*) from public.audit_logs)::int > 0, true, 'owner는 감사 로그를 조회한다');
select throws_ok('update public.audit_logs set action = ''x''', '42501', null, 'owner update 불가');

select tests.clear_authentication();
set local role service_role;
select throws_ok('delete from public.audit_logs', '42501', null, 'service_role delete 불가');
reset role;

-- 테이블 소유자(postgres)도 트리거로 차단
select throws_ok('update public.audit_logs set action = ''x''', 'GB403', 'audit_logs is append-only', 'postgres update도 트리거로 차단');
select throws_ok('delete from public.audit_logs', 'GB403', 'audit_logs is append-only', 'postgres delete도 트리거로 차단');

select * from finish();
rollback;

-- (b) 클라이언트는 status를 직접 바꿀 수 없다. 테이블 DML은 모든 API 역할에서 막혀 있다(소재: 회원권 거래)
begin;
select plan(10);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

select tests.authenticate_as(:'a', 'aal1');
select id as deal from tests.new_deal() \gset

select throws_ok(
  format($q$update public.membership_deals set status = 'completed' where id = %L$q$, :'deal'),
  '42501', null, '고객은 membership_deals.status를 직접 update할 수 없다');
select throws_ok(
  $q$insert into public.membership_deals (user_id, side, product_id)
     values (auth.uid(), 'sell', '00000000-0000-4000-b000-000000000003')$q$,
  '42501', null, '고객은 거래를 직접 insert할 수 없다');
select throws_ok(
  format($q$delete from public.membership_deals where id = %L$q$, :'deal'),
  '42501', null, '고객은 거래를 직접 delete할 수 없다');
select throws_ok(
  $q$update public.membership_listings set status = 'reserved'$q$,
  '42501', null, '고객은 매물 상태를 직접 바꿀 수 없다');
select throws_ok(
  $q$insert into public.audit_logs (actor_role, entity_type, entity_id, action) values ('customer', 'x', 'x', 'x')$q$,
  '42501', null, '고객은 감사 로그를 위조할 수 없다');
select throws_ok(
  $q$insert into public.notification_outbox (event_type, recipient_kind, channel, template_code, dedupe_key)
     values ('x', 'admins', 'slack', 'X', 'x')$q$,
  '42501', null, '고객은 outbox에 직접 적재할 수 없다');

-- 운영자(aal2)도 직접 DML은 불가. 함수로만 바꾼다.
select tests.authenticate_as(:'admin');
select throws_ok(
  format($q$update public.membership_deals set status = 'cancelled' where id = %L$q$, :'deal'),
  '42501', null, '운영자도 status를 직접 update할 수 없다');

-- service_role(서버 admin 클라이언트)도 DML 불가
select tests.clear_authentication();
set local role service_role;
select throws_ok(
  format($q$update public.membership_deals set status = 'cancelled' where id = %L$q$, :'deal'),
  '42501', null, 'service_role도 status를 직접 update할 수 없다');
reset role;

-- 내부 헬퍼와 배치 함수는 API 역할이 호출할 수 없다
select tests.authenticate_as(:'a', 'aal1');
select throws_ok('select app.invoke_notify_dispatcher()', '42501', null, '고객은 배치 함수를 호출할 수 없다');
select throws_ok(
  $q$select app.write_audit('x', 'x', 'x', null, null)$q$, '42501', null, '고객은 감사 기록 헬퍼를 호출할 수 없다');

select * from finish();
rollback;

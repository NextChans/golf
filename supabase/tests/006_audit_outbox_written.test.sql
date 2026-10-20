-- (e) 상태 변경 시 같은 트랜잭션에서 audit_logs와 outbox 행이 생긴다. 실패하면 둘 다 남지 않는다.
begin;
select plan(11);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

select tests.authenticate_as(:'a', 'aal1');
select set_config('request.headers', '{"x-client-ip":"203.0.113.7","x-client-ua":"vitest"}', true);
select id as req from tests.new_booking() \gset

select tests.clear_authentication();
select is((select count(*) from public.audit_logs where entity_id = :'req' and action = 'create')::int, 1, '생성 감사 로그 1건');
select is((select actor_id from public.audit_logs where entity_id = :'req' and action = 'create'), :'a'::uuid, '행위자 기록');
select is((select host(ip) from public.audit_logs where entity_id = :'req' and action = 'create'), '203.0.113.7', 'IP 기록');
select is((select user_agent from public.audit_logs where entity_id = :'req' and action = 'create'), 'vitest', 'UA 기록');
select is((select count(*) from public.notification_outbox where dedupe_key = format('booking:%s:requested', :'req'))::int, 1,
  '신규 요청 시 운영자 알림 적재');
select is((select count(*) from public.booking_events where request_id = :'req')::int, 1, '고객 타임라인 1건');

select tests.authenticate_as(:'admin');
select public.assign_booking(:'req', :'admin', 1);
select id as p from public.propose_booking(:'req', 2, now() + interval '2 days', 150000) \gset

select tests.clear_authentication();
select ok((select before is not null and after is not null from public.audit_logs
            where entity_id = :'req' and action = 'propose'), '전이 감사 로그에 before/after 기록');
select is((select count(*) from public.notification_outbox
            where recipient_user_id = :'a' and template_code in ('BOOKING_IN_REVIEW', 'BOOKING_PROPOSED'))::int, 2,
  '배정·제안 시 고객 알림 적재');

-- 실패한 전이는 아무것도 남기지 않는다
select count(*) as audit_before from public.audit_logs \gset
select count(*) as outbox_before from public.notification_outbox \gset
select tests.authenticate_as(:'admin');
select throws_ok(format('select public.reject_booking(%L, 99, ''사유'')', :'req'), 'GB409', 'version_conflict', '버전 충돌로 실패');
select tests.clear_authentication();
select is((select count(*) from public.audit_logs)::int, :audit_before, '실패 시 감사 로그 없음');
select is((select count(*) from public.notification_outbox)::int, :outbox_before, '실패 시 outbox 없음');

select * from finish();
rollback;

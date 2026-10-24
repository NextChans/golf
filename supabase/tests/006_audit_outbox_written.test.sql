-- (e) 상태 변경 시 같은 트랜잭션에서 audit_logs와 outbox 행이 생긴다. 실패하면 둘 다 남지 않는다(소재: 회원권 거래)
begin;
select plan(11);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

select tests.authenticate_as(:'a', 'aal1');
select set_config('request.headers', '{"x-client-ip":"203.0.113.7","x-client-ua":"vitest"}', true);
select id as deal from tests.new_deal() \gset

select tests.clear_authentication();
select is((select count(*) from public.audit_logs where entity_id = :'deal' and action = 'create')::int, 1, '생성 감사 로그 1건');
select is((select actor_id from public.audit_logs where entity_id = :'deal' and action = 'create'), :'a'::uuid, '행위자 기록');
select is((select host(ip) from public.audit_logs where entity_id = :'deal' and action = 'create'), '203.0.113.7', 'IP 기록');
select is((select user_agent from public.audit_logs where entity_id = :'deal' and action = 'create'), 'vitest', 'UA 기록');
select is((select count(*) from public.notification_outbox where dedupe_key = format('deal:%s:requested', :'deal'))::int, 1,
  '신규 상담 시 운영자 알림 적재');
select is((select count(*) from public.deal_events where deal_id = :'deal')::int, 1, '고객 타임라인 1건');

select tests.authenticate_as(:'admin');
select public.start_deal(:'deal', 1);
select public.update_deal_terms(:'deal', 2, null, current_date + 7);
select public.advance_deal(:'deal', 3, 'contract_scheduled');

select tests.clear_authentication();
select ok((select before is not null and after is not null from public.audit_logs
            where entity_id = :'deal' and action = 'start'), '전이 감사 로그에 before/after 기록');
select is((select count(*) from public.notification_outbox
            where recipient_user_id = :'a' and template_code = 'DEAL_STATUS_CHANGED')::int, 2,
  '협의 시작·단계 진행 시 고객 알림 적재');

-- 실패한 전이는 아무것도 남기지 않는다
select count(*) as audit_before from public.audit_logs \gset
select count(*) as outbox_before from public.notification_outbox \gset
select tests.authenticate_as(:'admin');
select throws_ok(format('select public.cancel_deal(%L, 99, ''사유'')', :'deal'), 'GB409', 'version_conflict', '버전 충돌로 실패');
select tests.clear_authentication();
select is((select count(*) from public.audit_logs)::int, :audit_before, '실패 시 감사 로그 없음');
select is((select count(*) from public.notification_outbox)::int, :outbox_before, '실패 시 outbox 없음');

select * from finish();
rollback;

-- 배치: 제안 만료, SLA 초과 표시, SLA 기한 계산, cron 등록
begin;
select plan(12);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

select tests.authenticate_as(:'a', 'aal1');
select id as req from tests.new_booking() \gset
select tests.authenticate_as(:'admin');
select public.assign_booking(:'req', :'admin', 1);
select id as p from public.propose_booking(:'req', 2, now() + interval '2 days', 150000) \gset

-- 만료 시각을 과거로 돌린다(슈퍼유저로 테스트 픽스처 조작)
select tests.clear_authentication();
update public.booking_proposals set expires_at = now() - interval '1 minute' where id = :'p';

select is(app.expire_proposals(), 1, '만료 대상 1건 처리');
select is((select status::text from public.booking_proposals where id = :'p'), 'expired', '제안 expired');
select is((select status::text from public.booking_requests where id = :'req'), 'in_review', '요청 in_review 복귀');
select is((select version from public.booking_requests where id = :'req'), 4, '만료도 version을 올린다');
select is(app.expire_proposals(), 0, '두 번 돌려도 중복 처리 없음');
select is((select count(*) from public.audit_logs where entity_id = :'p' and action = 'expire' and actor_role = 'system')::int, 1,
  '시스템 행위자로 감사 기록');

-- 만료된 제안은 고객이 수락할 수 없다(배치 전이라도)
select tests.authenticate_as(:'admin');
select id as p2 from public.propose_booking(:'req', 4, now() + interval '2 days', 150000) \gset
select tests.clear_authentication();
update public.booking_proposals set expires_at = now() - interval '1 second' where id = :'p2';
select tests.authenticate_as(:'a', 'aal1');
select throws_ok(format('select public.accept_proposal(gen_random_uuid(), %L, 5)', :'p2'), 'GB409', 'proposal_expired',
  '배치 실행 전이라도 만료된 제안은 수락 불가');

-- SLA 초과
select tests.authenticate_as(:'a', 'aal1');
select id as req2 from tests.new_booking() \gset
select tests.clear_authentication();
update public.booking_requests set sla_due_at = now() - interval '1 minute' where id = :'req2';
select ok(app.mark_sla_breaches() >= 1, 'SLA 초과 표시');
select isnt((select sla_breached_at from public.booking_requests where id = :'req2'), null, 'sla_breached_at 기록');
select is(app.mark_sla_breaches(), 0, 'SLA 알림은 한 번만');

-- 영업시간 계산: 금요일 17:50 KST + 30분 → 월요일 09:20 KST
select is(app.business_sla_due('2026-10-23 17:50:00+09', 30), '2026-10-26 09:20:00+09'::timestamptz, '주말을 건너뛴 SLA 기한');

select is((select count(*) from cron.job where jobname in ('expire-proposals', 'mark-sla-breaches', 'purge-idempotency-keys'))::int, 3,
  'cron 잡 3개 등록');

select * from finish();
rollback;

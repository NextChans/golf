-- 배치: SLA 기한 계산(범용 헬퍼), cron 등록, 멱등키 정리 잡
-- 제안 만료·SLA 초과 배치는 부킹과 함께 제거(D-88)
begin;
select plan(8);

-- 영업시간 계산: 금요일 17:50 KST + 30분 → 월요일 09:20 KST
select is(app.business_sla_due('2026-10-23 17:50:00+09', 30), '2026-10-26 09:20:00+09'::timestamptz, '주말을 건너뛴 SLA 기한');
select is(app.business_sla_due('2026-10-26 10:00:00+09', 30), '2026-10-26 10:30:00+09'::timestamptz, '영업시간 안에서는 그대로 더한다');
select is(app.business_sla_due('2026-10-26 07:00:00+09', 30), '2026-10-26 09:30:00+09'::timestamptz, '영업 시작 전이면 09:00부터');
insert into public.business_holidays (holiday, name) values ('2026-10-26', '테스트 공휴일');
select is(app.business_sla_due('2026-10-23 17:50:00+09', 30), '2026-10-27 09:20:00+09'::timestamptz, '공휴일도 건너뛴다');

-- cron: 남는 잡은 멱등키 정리와 알림 발송
select is((select count(*) from cron.job where jobname in ('purge-idempotency-keys', 'notify-dispatch'))::int, 2,
  'cron 잡 2개 등록');
select is((select count(*) from cron.job where jobname in ('expire-proposals', 'mark-sla-breaches'))::int, 0,
  '부킹 배치 cron 잡은 없다');

-- 멱등키 정리 잡의 명령을 그대로 실행: 24시간 지난 키만 지운다
select tests.create_user('a@test.local') as a \gset
insert into public.idempotency_keys (user_id, key, action, request_hash, created_at) values
  (:'a', '22222222-2222-4222-8222-222222222222', 'test', 'h', now() - interval '25 hours'),
  (:'a', '33333333-3333-4333-8333-333333333333', 'test', 'h', now() - interval '1 hour');
select command as purge_cmd from cron.job where jobname = 'purge-idempotency-keys' \gset
:purge_cmd;
select is((select count(*) from public.idempotency_keys where key = '22222222-2222-4222-8222-222222222222')::int, 0,
  '24시간 지난 멱등키는 정리된다');
select is((select count(*) from public.idempotency_keys where key = '33333333-3333-4333-8333-333333333333')::int, 1,
  '최근 멱등키는 남는다');

select * from finish();
rollback;

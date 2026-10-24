-- 멱등키와 rate limit(소재: 회원권 상담 create_deal_inquiry)
begin;
select plan(7);

select tests.create_user('a@test.local') as a \gset
\set key '11111111-1111-4111-8111-111111111111'
\set product '00000000-0000-4000-b000-000000000003'

select tests.authenticate_as(:'a', 'aal1');
select id as d1 from public.create_deal_inquiry(:'key', 'sell', null, :'product', 170000000, '평일 저녁', null) \gset
select id as d2 from public.create_deal_inquiry(:'key', 'sell', null, :'product', 170000000, '평일 저녁', null) \gset
select is(:'d2'::uuid, :'d1'::uuid, '같은 키·같은 내용 재호출은 같은 결과');
select is((select count(*) from public.membership_deals where user_id = :'a')::int, 1, '중복 생성 없음');
select throws_ok(format($q$select public.create_deal_inquiry(%L, 'sell', null, %L, 180000000, '평일 저녁', null)$q$, :'key', :'product'),
  'GB409', 'idempotency_key_reused', '같은 키에 다른 내용은 거부');

-- 잘못된 입력은 GB422
select throws_ok(format($q$select public.create_deal_inquiry(gen_random_uuid(), 'sell', '00000000-0000-4000-c000-000000000001', %L, null, null, null)$q$, :'product'),
  'GB422', 'invalid_input', '매도 상담에 매물을 지정하면 invalid_input');
select throws_ok(format($q$select public.create_deal_inquiry(gen_random_uuid(), 'sell', null, %L, -1, null, null)$q$, :'product'),
  'GB422', 'invalid_input', '음수 희망가는 invalid_input');

-- rate limit: 10분당 5건(이미 1건) → 4건 더 성공, 6번째 실패
select tests.new_deal() from generate_series(1, 4);
select throws_ok('select tests.new_deal()', 'GB429', 'rate_limited', '6번째 상담은 rate limit');
-- 멱등 재호출은 rate limit에 걸리지 않는다
select is((public.create_deal_inquiry(:'key', 'sell', null, :'product', 170000000, '평일 저녁', null)).id, :'d1'::uuid,
  '멱등 재호출은 rate limit 예외');

select * from finish();
rollback;

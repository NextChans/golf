-- 멱등키와 rate limit
begin;
select plan(7);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
\set key '11111111-1111-4111-8111-111111111111'

select tests.authenticate_as(:'a', 'aal1');
select id as r1 from public.create_booking_request(:'key', '00000000-0000-4000-a000-000000000001', null,
  (now() at time zone 'Asia/Seoul')::date + 5, 'range', '07:00', '09:00', 2, null, null) \gset
select id as r2 from public.create_booking_request(:'key', '00000000-0000-4000-a000-000000000001', null,
  (now() at time zone 'Asia/Seoul')::date + 5, 'range', '07:00', '09:00', 2, null, null) \gset
select is(:'r2'::uuid, :'r1'::uuid, '같은 키·같은 내용 재호출은 같은 결과');
select is((select count(*) from public.booking_requests)::int, 1, '중복 생성 없음');
select throws_ok(format($q$select public.create_booking_request(%L, '00000000-0000-4000-a000-000000000001', null,
  (now() at time zone 'Asia/Seoul')::date + 6, 'part_2', null, null, 2, null, null)$q$, :'key'),
  'GB409', 'idempotency_key_reused', '같은 키에 다른 내용은 거부');

-- 잘못된 입력은 GB422
select throws_ok($q$select public.create_booking_request(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', null,
  (now() at time zone 'Asia/Seoul')::date + 5, 'range', '09:00', '07:00', 2, null, null)$q$,
  'GB422', 'invalid_input', '시간 범위 역전은 invalid_input');
select throws_ok($q$select public.create_booking_request(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', null,
  (now() at time zone 'Asia/Seoul')::date - 1, 'part_1', null, null, 2, null, null)$q$,
  'GB422', 'invalid_input', '과거 날짜는 invalid_input');

-- rate limit: 10분당 5건(이미 1건) → 4건 더 성공, 6번째 실패
select tests.new_booking() from generate_series(1, 4);
select throws_ok('select tests.new_booking()', 'GB429', 'rate_limited', '6번째 요청은 rate limit');
-- 멱등 재호출은 rate limit에 걸리지 않는다
select is((public.create_booking_request(:'key', '00000000-0000-4000-a000-000000000001', null,
  (now() at time zone 'Asia/Seoul')::date + 5, 'range', '07:00', '09:00', 2, null, null)).id, :'r1'::uuid,
  '멱등 재호출은 rate limit 예외');

select * from finish();
rollback;

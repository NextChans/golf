-- (c) 부킹 상태 머신: 허용 전이는 통과, 그 외는 예외
begin;
select plan(24);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('pending@test.local', 'customer', false) as pending \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
select tests.create_user('admin2@test.local', 'admin') as admin2 \gset
select tests.create_user('owner@test.local', 'owner') as owner \gset

-- 온보딩 미완료 고객은 요청 불가
select tests.authenticate_as(:'pending', 'aal1');
select throws_ok('select tests.new_booking()', 'GB403', 'onboarding_required', '온보딩 전에는 요청할 수 없다');

-- 운영자는 고객 요청을 만들 수 없다
select tests.authenticate_as(:'admin');
select throws_ok('select tests.new_booking()', 'GB403', 'forbidden', '운영자는 고객 요청을 만들 수 없다');

select tests.authenticate_as(:'a', 'aal1');
select id as req, status::text as st, version as v from tests.new_booking() \gset
select is(:'st'::text, 'requested', '생성 시 requested');

-- 고객은 운영자 함수를 쓸 수 없다
select throws_ok(format('select public.assign_booking(%L, %L, 1)', :'req', :'a'), 'GB403', 'forbidden', '고객은 배정할 수 없다');

-- aal1 운영자는 거부(MFA 강제)
select tests.authenticate_as(:'admin', 'aal1');
select throws_ok(format('select public.assign_booking(%L, %L, 1)', :'req', :'admin'), 'GB403', 'forbidden', 'aal1 운영자는 배정할 수 없다');

select tests.authenticate_as(:'admin');
select throws_ok(format('select public.assign_booking(%L, %L, 1)', :'req', :'a'), 'GB422', 'invalid_input', '고객에게는 배정할 수 없다');
select throws_ok(format('select public.propose_booking(%L, 1, now() + interval ''2 days'', 150000)', :'req'),
  'GB409', 'invalid_state', 'requested에서 바로 제안할 수 없다');
select throws_ok(format('select public.assign_booking(%L, %L, 99)', :'req', :'admin'), 'GB409', 'version_conflict', 'version이 다르면 실패');

select is((public.assign_booking(:'req', :'admin', 1)).status::text, 'in_review', '배정 시 in_review');
select isnt((select first_responded_at from public.booking_requests where id = :'req'), null, '배정 시 1차 응답 시각 기록');

-- 담당자가 아닌 운영자는 제안 불가, owner는 가능
select tests.authenticate_as(:'admin2');
select throws_ok(format('select public.propose_booking(%L, 2, now() + interval ''2 days'', 150000)', :'req'),
  'GB403', 'forbidden', '담당자가 아닌 운영자는 제안할 수 없다');

select tests.authenticate_as(:'admin');
select throws_ok(format('select public.propose_booking(%L, 2, now() - interval ''1 hour'', 150000)', :'req'),
  'GB422', 'invalid_input', '과거 티타임은 제안할 수 없다');
select throws_ok(format('select public.propose_booking(%L, 2, now() + interval ''2 days'', 150000, 10)', :'req'),
  'GB422', 'invalid_input', '유효시간은 30분 이상');
select id as p1 from public.propose_booking(:'req', 2, now() + interval '2 days', 150000) \gset

-- 재제안 시 이전 제안은 withdrawn
select tests.authenticate_as(:'owner');
select id as p2 from public.propose_booking(:'req', 3, now() + interval '3 days', 160000, 60) \gset
select tests.clear_authentication();
select is((select status::text from public.booking_proposals where id = :'p1'), 'withdrawn', '재제안 시 이전 제안은 withdrawn');
select is((select expires_at from public.booking_proposals where id = :'p2') <= now() + interval '60 minutes', true, '유효시간 반영');

-- 고객: 철회된 제안 수락 불가, 거절 후 in_review, 다시 제안 받아 수락
select tests.authenticate_as(:'a', 'aal1');
select throws_ok(format('select public.accept_proposal(gen_random_uuid(), %L, 4)', :'p1'),
  'GB409', 'invalid_state', '철회된 제안은 수락할 수 없다');
select is((public.decline_proposal(:'p2', 4, '시간이 안 맞음')).status::text, 'in_review', '거절하면 in_review로 복귀');

select tests.authenticate_as(:'admin');
select id as p3 from public.propose_booking(:'req', 5, now() + interval '4 days', 170000) \gset

select tests.authenticate_as(:'a', 'aal1');
select is((public.accept_proposal(gen_random_uuid(), :'p3', 6)).status::text, 'confirmed', '수락하면 confirmed');

-- 확정 후 고객 취소 불가, 운영자는 사유와 함께 가능
select throws_ok(format('select public.cancel_booking(%L, 7)', :'req'), 'GB409', 'invalid_state', '확정 후 고객은 취소할 수 없다');
select tests.authenticate_as(:'admin');
select throws_ok(format('select public.cancel_booking(%L, 7)', :'req'), 'GB422', 'invalid_input', '운영자 취소는 사유가 필요하다');
select is((public.cancel_booking(:'req', 7, '골프장 사정')).status::text, 'cancelled', '운영자는 확정 건을 취소할 수 있다');
select throws_ok(format('select public.reject_booking(%L, 8, ''x'')', :'req'), 'GB409', 'invalid_state', '종료 상태에서 거절할 수 없다');

-- 거절 경로
select tests.authenticate_as(:'a', 'aal1');
select id as req2 from tests.new_booking() \gset
select tests.authenticate_as(:'admin');
select throws_ok(format('select public.reject_booking(%L, 1, '' '')', :'req2'), 'GB422', 'invalid_input', '거절 사유 필수');
select is((public.reject_booking(:'req2', 1, '해당 날짜 만석')).status::text, 'rejected', 'requested에서 바로 거절 가능');

select * from finish();
rollback;

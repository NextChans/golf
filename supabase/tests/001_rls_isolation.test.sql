-- (a) 고객 간 데이터 격리, 비로그인 공개 범위
begin;
select plan(13);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

select tests.authenticate_as(:'a', 'aal1');
select id as a_req from tests.new_booking() \gset

select tests.authenticate_as(:'admin');
select (public.assign_booking(:'a_req', :'admin', 1)).version as v \gset
select (public.propose_booking(:'a_req', :'v', now() + interval '3 days', 180000)).id as a_prop \gset

-- 고객 B
select tests.authenticate_as(:'b', 'aal1');
select is((select count(*) from public.booking_requests)::int, 0, 'B는 A의 요청을 볼 수 없다');
select is((select count(*) from public.booking_proposals)::int, 0, 'B는 A의 제안을 볼 수 없다');
select is((select count(*) from public.booking_events)::int, 0, 'B는 A의 타임라인을 볼 수 없다');
select is((select count(*) from public.profiles)::int, 1, 'B는 본인 프로필만 본다');
select throws_ok(
  format('select public.accept_proposal(gen_random_uuid(), %L, 2)', :'a_prop'),
  'GB404', 'not_found', 'B는 A의 제안을 수락할 수 없고 존재 여부도 알 수 없다');
select throws_ok(
  format('select public.cancel_booking(%L, 3)', :'a_req'),
  'GB404', 'not_found', 'B는 A의 요청을 취소할 수 없다');

-- 고객 A
select tests.authenticate_as(:'a', 'aal1');
select is((select count(*) from public.booking_requests)::int, 1, 'A는 본인 요청을 본다');
select is((select count(*) from public.booking_proposals)::int, 1, 'A는 본인 제안을 본다');
select is((select count(*) from public.activity_notes)::int, 0, '고객은 운영자 메모를 볼 수 없다');

-- user_metadata.role=owner 위조(헬퍼가 넣음)로도 운영자가 되지 않는다
select is(app.is_admin(), false, 'user_metadata.role은 권한 판별에 쓰이지 않는다');

-- 운영자라도 aal1이면 운영자 권한 없음
select tests.authenticate_as(:'admin', 'aal1');
select is((select count(*) from public.booking_requests where id = :'a_req')::int, 0, 'aal1 운영자는 고객 데이터를 볼 수 없다');

-- 비로그인
select tests.authenticate_anon();
select is((select count(*) from public.membership_listings where status = 'hidden')::int, 0, '비로그인은 hidden 매물을 볼 수 없다');
select throws_ok('select created_by from public.membership_listings', '42501', null, '비로그인은 매물 등록자(운영자 id)를 볼 수 없다');

select * from finish();
rollback;

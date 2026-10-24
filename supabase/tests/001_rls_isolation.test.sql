-- (a) 고객 간 데이터 격리, 비로그인 공개 범위(소재: 회원권 거래. 부킹은 D-88로 제거)
begin;
select plan(13);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

select tests.authenticate_as(:'a', 'aal1');
select id as a_deal from tests.new_deal() \gset

-- 운영자가 협의를 시작해 타임라인(deal_events)·고객 알림이 쌓인 상태
select tests.authenticate_as(:'admin');
select (public.start_deal(:'a_deal', 1)).version as v \gset

-- 고객 B
select tests.authenticate_as(:'b', 'aal1');
select is((select count(*) from public.membership_deals)::int, 0, 'B는 A의 거래를 볼 수 없다');
select is((select count(*) from public.deal_events)::int, 0, 'B는 A의 거래 타임라인을 볼 수 없다');
select is((select count(*) from public.notification_outbox)::int, 0, 'B는 A의 알림(outbox)을 볼 수 없다');
select is((select count(*) from public.profiles)::int, 1, 'B는 본인 프로필만 본다');
select throws_ok(
  format('select public.cancel_deal(%L, %s)', :'a_deal', :v),
  'GB404', 'not_found', 'B는 A의 거래를 취소할 수 없다');
select throws_ok(
  format('select public.cancel_deal(%L, %s)', gen_random_uuid(), :v),
  'GB404', 'not_found', '없는 거래와 같은 오류라 B는 A의 거래 존재 여부를 알 수 없다');

-- 고객 A
select tests.authenticate_as(:'a', 'aal1');
select is((select count(*) from public.membership_deals)::int, 1, 'A는 본인 거래를 본다');
select is((select count(*) from public.deal_events)::int, 2, 'A는 본인 거래 타임라인을 본다');
select is((select count(*) from public.activity_notes)::int, 0, '고객은 운영자 메모를 볼 수 없다');

-- user_metadata.role=owner 위조(헬퍼가 넣음)로도 운영자가 되지 않는다
select is(app.is_admin(), false, 'user_metadata.role은 권한 판별에 쓰이지 않는다');

-- 운영자라도 aal1이면 운영자 권한 없음
select tests.authenticate_as(:'admin', 'aal1');
select is((select count(*) from public.membership_deals where id = :'a_deal')::int, 0, 'aal1 운영자는 고객 데이터를 볼 수 없다');

-- 비로그인
select tests.authenticate_anon();
select is((select count(*) from public.membership_listings where status = 'hidden')::int, 0, '비로그인은 hidden 매물을 볼 수 없다');
select throws_ok('select created_by from public.membership_listings', '42501', null, '비로그인은 매물 등록자(운영자 id)를 볼 수 없다');

select * from finish();
rollback;

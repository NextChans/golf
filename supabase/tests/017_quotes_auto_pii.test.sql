-- 체결가 자동 기록, 시세 일괄 입력, 개인정보 열람 기록
begin;
select plan(13);

select tests.create_user('buyer@test.local') as buyer \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
\set product '00000000-0000-4000-b000-000000000002'

-- 테스트 전용 공개 매물
insert into public.membership_listings (product_id, asking_price, status) values (:'product', 93000000, 'listed') returning id as lid \gset

select tests.authenticate_as(:'buyer', 'aal1');
select id as d from public.create_deal_inquiry(gen_random_uuid(), 'buy', :'lid', null, null, null, null) \gset
select tests.authenticate_as(:'admin');
select public.start_deal(:'d', 1);
select public.update_deal_terms(:'d', 2, 91500000, current_date + 10);
select public.advance_deal(:'d', 3, 'contract_scheduled');
select public.advance_deal(:'d', 4, 'contracted');
select public.advance_deal(:'d', 5, 'transferring');
select tests.clear_authentication();
select is((select count(*)::int from public.membership_trades where deal_id = :'d'), 0, '완료 전에는 체결가 없음');
select tests.authenticate_as(:'admin');
select public.advance_deal(:'d', 6, 'completed');
select tests.clear_authentication();
select is((select price from public.membership_trades where deal_id = :'d'), 91500000::bigint, '거래 완료 시 합의가가 체결가로 기록');
select is((select traded_on from public.membership_trades where deal_id = :'d'), (now() at time zone 'Asia/Seoul')::date, '체결일은 KST 날짜');

-- 공개 조회: 비로그인도 가격은 보지만 거래 id는 못 본다
select tests.authenticate_anon();
select ok(exists(select price from public.membership_trades where product_id = :'product' and price = 91500000), '비로그인도 체결가 조회');
select throws_ok('select deal_id from public.membership_trades limit 1', '42501', null, '거래 id 컬럼은 비공개');
select throws_ok(format($q$insert into public.membership_trades (deal_id, product_id, side, price, traded_on) values (%L, %L, 'buy', 1, current_date)$q$, :'d', :'product'),
  '42501', null, '체결가 직접 입력 불가');

-- 시세 일괄 입력
select tests.authenticate_as(:'buyer', 'aal1');
select throws_ok($q$select public.bulk_upsert_quotes('[]'::jsonb)$q$, 'GB403', 'forbidden', '고객은 일괄 입력 불가');
select tests.authenticate_as(:'admin');
select is(public.bulk_upsert_quotes(jsonb_build_array(
  jsonb_build_object('product_id', :'product', 'quoted_on', current_date - 3, 'buy_price', 95000000, 'sell_price', 90000000),
  jsonb_build_object('product_id', :'product', 'quoted_on', current_date - 2, 'buy_price', 96000000, 'sell_price', null))), 2, '2행 반영');
select tests.clear_authentication();
select is((select source from public.membership_quotes where product_id = :'product' and quoted_on = current_date - 2), 'csv', '출처 csv');
select tests.authenticate_as(:'admin');
select throws_ok(format($q$select public.bulk_upsert_quotes(jsonb_build_array(
  jsonb_build_object('product_id', %L, 'quoted_on', current_date - 1, 'buy_price', 1),
  jsonb_build_object('product_id', %L, 'quoted_on', 'not-a-date', 'buy_price', 1)))$q$, :'product', :'product'),
  'GB422', 'invalid_input', '잘못된 행이 있으면 전체 거부');
select tests.clear_authentication();
select is((select count(*)::int from public.membership_quotes where product_id = :'product' and quoted_on = current_date - 1), 0, '거부된 묶음은 하나도 반영되지 않음');

-- 개인정보 열람 기록: 10분에 1건
select tests.authenticate_as(:'admin');
select public.log_pii_view('customer', :'buyer');
select public.log_pii_view('customer', :'buyer');
select tests.clear_authentication();
select is((select count(*)::int from public.audit_logs where entity_type = 'pii_view' and entity_id = 'customer:' || :'buyer' and actor_id = :'admin'), 1,
  '같은 대상 열람은 10분에 1건만 기록');
select tests.authenticate_as(:'buyer', 'aal1');
select throws_ok(format($q$select public.log_pii_view('customer', %L)$q$, :'buyer'), 'GB403', 'forbidden', '고객은 열람 기록 함수 호출 불가');

select * from finish();
rollback;

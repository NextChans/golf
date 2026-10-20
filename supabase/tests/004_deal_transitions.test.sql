-- (c) 회원권 거래 상태 머신, 매물 선점·복원·판매완료
begin;
select plan(20);

select tests.create_user('a@test.local') as a \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
select tests.create_user('admin2@test.local', 'admin') as admin2 \gset

\set listing '00000000-0000-4000-c000-000000000001'
\set hidden_listing '00000000-0000-4000-c000-000000000003'

select tests.authenticate_as(:'a', 'aal1');
select throws_ok(format($q$select public.create_deal_inquiry(gen_random_uuid(), 'buy', %L, null, null, null, null)$q$, :'hidden_listing'),
  'GB409', 'listing_unavailable', '비공개 매물에는 상담 신청할 수 없다');
select id as d1 from public.create_deal_inquiry(gen_random_uuid(), 'buy', :'listing', null, 310000000, '평일 저녁', null) \gset
select throws_ok(format($q$select public.create_deal_inquiry(gen_random_uuid(), 'buy', %L, null, null, null, null)$q$, :'listing'),
  'GB409', 'duplicate_inquiry', '같은 매물에 진행 중 상담은 1건');

select tests.authenticate_as(:'b', 'aal1');
select id as d2 from public.create_deal_inquiry(gen_random_uuid(), 'buy', :'listing', null, null, null, null) \gset

select tests.authenticate_as(:'a', 'aal1');
select throws_ok(format('select public.start_deal(%L, 1)', :'d1'), 'GB403', 'forbidden', '고객은 협의를 시작할 수 없다');

select tests.authenticate_as(:'admin');
select is((public.start_deal(:'d1', 1)).status::text, 'negotiating', 'inquiry → negotiating');
select tests.clear_authentication();
select is((select status::text from public.membership_listings where id = :'listing'), 'reserved', '협의 시작 시 매물 reserved');

select tests.authenticate_as(:'admin');
select throws_ok(format('select public.start_deal(%L, 1)', :'d2'), 'GB409', 'listing_unavailable', '이미 선점된 매물은 협의 시작 불가');
select throws_ok(format($q$select public.advance_deal(%L, 2, 'contracted')$q$, :'d1'), 'GB409', 'invalid_state', '단계를 건너뛸 수 없다');
select throws_ok(format($q$select public.advance_deal(%L, 2, 'contract_scheduled')$q$, :'d1'), 'GB422', 'invalid_input', '계약일 없이 계약 일정 단계로 갈 수 없다');
select tests.authenticate_as(:'admin2');
select throws_ok(format('select public.update_deal_terms(%L, 2, 1, null)', :'d1'), 'GB403', 'forbidden', '담당자가 아니면 조건을 바꿀 수 없다');
select tests.authenticate_as(:'admin');
select is((public.update_deal_terms(:'d1', 2, null, current_date + 7)).version, 3, '계약일 입력');
select is((public.advance_deal(:'d1', 3, 'contract_scheduled')).status::text, 'contract_scheduled', 'negotiating → contract_scheduled');
select throws_ok(format($q$select public.advance_deal(%L, 4, 'contracted')$q$, :'d1'), 'GB422', 'invalid_input', '합의가 없이 계약 체결 불가');

-- 고객은 계약 일정 이후 직접 취소 불가
select tests.authenticate_as(:'a', 'aal1');
select throws_ok(format('select public.cancel_deal(%L, 4)', :'d1'), 'GB409', 'invalid_state', '계약 일정 이후 고객 취소 불가');

-- 운영자 취소 → 매물 listed 복원
select tests.authenticate_as(:'admin');
select is((public.cancel_deal(:'d1', 4, '매수 의사 철회')).status::text, 'cancelled', '운영자 취소');
select tests.clear_authentication();
select is((select status::text from public.membership_listings where id = :'listing'), 'listed', '취소 시 매물 listed 복원');

-- 다른 고객이 이어서 협의 → 완료까지 → sold
select tests.authenticate_as(:'admin');
select (public.start_deal(:'d2', 1)).version as v \gset
select (public.update_deal_terms(:'d2', :v, 315000000, current_date + 3)).version as v \gset
select (public.advance_deal(:'d2', :v, 'contract_scheduled')).version as v \gset
select (public.advance_deal(:'d2', :v, 'contracted')).version as v \gset
select (public.advance_deal(:'d2', :v, 'transferring')).version as v \gset
select is((public.advance_deal(:'d2', :v, 'completed')).status::text, 'completed', '완료');
select tests.clear_authentication();
select is((select status::text from public.membership_listings where id = :'listing'), 'sold', '완료 시 매물 sold');

select tests.authenticate_as(:'admin');
select throws_ok(format('select public.cancel_deal(%L, %s, ''x'')', :'d2', :v + 1), 'GB409', 'invalid_state', '완료된 거래는 취소할 수 없다');
select throws_ok(format('select public.set_listing_visibility(%L, false)', :'listing'), 'GB409', 'invalid_state', '판매완료 매물은 노출 전환 불가');

-- 매도 상담: 매물 없이 진행, 고객은 협의 단계에서 취소 가능
select tests.authenticate_as(:'a', 'aal1');
select id as d3 from public.create_deal_inquiry(gen_random_uuid(), 'sell', null, '00000000-0000-4000-b000-000000000003', 170000000, null, null) \gset
select tests.authenticate_as(:'admin');
select (public.start_deal(:'d3', 1)).version as v \gset
select tests.authenticate_as(:'a', 'aal1');
select is((public.cancel_deal(:'d3', :v)).status::text, 'cancelled', '매도 상담은 협의 단계에서 고객 취소 가능');

select * from finish();
rollback;

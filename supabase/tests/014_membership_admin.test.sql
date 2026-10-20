-- M5: 회원권 상품·매물·시세 저장, 거래 담당자 배정
begin;
select plan(17);

select tests.create_user('cust@test.local') as cust \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
select tests.create_user('admin2@test.local', 'admin') as admin2 \gset
\set course '00000000-0000-4000-a000-000000000001'
\set product '00000000-0000-4000-b000-000000000001'

select tests.authenticate_as(:'cust', 'aal1');
select throws_ok(format($q$select public.upsert_listing(null, %L, 100000000, null)$q$, :'product'),
  'GB403', 'forbidden', '고객은 매물 등록 불가');
select throws_ok(format($q$select public.upsert_quote(%L, current_date, 1, 1)$q$, :'product'),
  'GB403', 'forbidden', '고객은 시세 등록 불가');

select tests.authenticate_as(:'admin');
-- 상품
select (public.upsert_membership_product(null, :'course', ' 가족회원 ', '구골프 레이크CC 가족회원', null)).id as pid \gset
select is((select kind from public.membership_products where id = :'pid'::uuid), '가족회원', '상품 생성');
select throws_ok(format($q$select public.upsert_membership_product(null, %L, '가족회원', 'x', true)$q$, :'course'),
  'GB409', 'duplicate_name', '같은 골프장·종류 중복 거부');

-- 매물: 새 매물은 hidden
select (public.upsert_listing(null, :'pid', 250000000, '  급매  ')).id as lid \gset
select is((select status::text from public.membership_listings where id = :'lid'::uuid), 'hidden', '새 매물은 비공개');
select is((select description from public.membership_listings where id = :'lid'::uuid), '급매', '설명 공백 제거');
select throws_ok(format($q$select public.upsert_listing(null, %L, 0, null)$q$, :'pid'),
  'GB422', 'invalid_input', '0원 호가 거부');
select is((public.upsert_listing(:'lid', :'pid', 240000000, null)).asking_price, 240000000::bigint, 'hidden 매물 호가 수정');

-- 공개 → 상담 → 협의 시작(reserved) 후 호가 변경 금지, 설명은 수정 가능
select public.set_listing_visibility(:'lid', true);
select tests.authenticate_as(:'cust', 'aal1');
select id as did from public.create_deal_inquiry(gen_random_uuid(), 'buy', :'lid', null, null, null, null) \gset
select tests.authenticate_as(:'admin');
select public.start_deal(:'did', 1);
select throws_ok(format($q$select public.upsert_listing(%L, %L, 230000000, null)$q$, :'lid', :'pid'),
  'GB409', 'invalid_state', '협의 중 호가 변경 금지');
select is((public.upsert_listing(:'lid', :'pid', 240000000, '협의 중')).description, '협의 중', '협의 중 설명 수정 가능');

-- 거래 배정
select throws_ok(format($q$select public.assign_deal(%L, %L, 2)$q$, :'did', :'cust'),
  'GB422', 'invalid_input', '고객에게 배정 불가');
select is((public.assign_deal(:'did', :'admin2', 2)).assignee_id, :'admin2'::uuid, '다른 운영자에게 배정');
select throws_ok(format($q$select public.assign_deal(%L, %L, 2)$q$, :'did', :'admin'),
  'GB409', 'version_conflict', '오래된 version 거부');

-- 시세: 같은 날은 덮어쓰기, 미래 날짜 거부
select (public.upsert_quote(:'pid', current_date, 245000000, 235000000)).id as qid \gset
select is((public.upsert_quote(:'pid', current_date, 246000000, null)).buy_price, 246000000::bigint, '같은 날 시세 덮어쓰기');
select is((select count(*)::int from public.membership_quotes where product_id = :'pid'::uuid), 1, '시세는 날짜당 1건');
select throws_ok(format($q$select public.upsert_quote(%L, current_date + 30, 1, 1)$q$, :'pid'),
  'GB422', 'invalid_input', '미래 날짜 시세 거부');

select tests.clear_authentication();
select is((select count(*)::int from public.audit_logs
            where (entity_type = 'membership_product' and entity_id = :'pid')
               or (entity_type = 'membership_quote' and entity_id = :'qid')
               or (entity_type = 'membership_deal' and entity_id = :'did' and action = 'assign')), 4,
  '상품 생성·시세 2회·배정이 감사 로그에 기록');

select * from finish();
rollback;

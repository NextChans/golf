-- M4: 골프장 마스터, 통화 메모, 배정 대상 운영자 목록
begin;
select plan(16);

select tests.create_user('cust@test.local') as cust \gset
select tests.create_user('other@test.local') as other \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

-- 고객은 호출 불가
select tests.authenticate_as(:'cust', 'aal1');
select throws_ok($q$select public.upsert_golf_course(null, '새 골프장', 'jeju', null, 100000, 150000, null, null, true)$q$,
  'GB403', 'forbidden', '고객은 골프장 저장 불가');
select throws_ok($q$select public.list_assignable_staff()$q$, 'GB403', 'forbidden', '고객은 운영자 목록 조회 불가');
select d.id as did from tests.new_deal() d \gset
select tests.authenticate_as(:'other', 'aal1');
select d.id as odid from tests.new_deal() d \gset

-- aal1 운영자는 거부
select tests.authenticate_as(:'admin', 'aal1');
select throws_ok($q$select public.upsert_golf_course(null, '새 골프장', 'jeju', null, 100000, 150000, null, null, true)$q$,
  'GB403', 'forbidden', 'MFA 전 운영자는 거부');

select tests.authenticate_as(:'admin');
select (public.upsert_golf_course(null, '  새 골프장  ', 'jeju', '제주시', 100000, 150000, '3일 전 무료', '064-000-0000', null)).id as gid \gset
select is((select name from public.golf_courses where id = :'gid'), '새 골프장', '골프장 생성(이름 공백 제거)');
select is((select is_active from public.golf_courses where id = :'gid'), true, '활성 기본값 true');
select throws_ok($q$select public.upsert_golf_course(null, '새 골프장', 'jeju', null, null, null, null, null, true)$q$,
  'GB409', 'duplicate_name', '중복 이름 거부');
select throws_ok($q$select public.upsert_golf_course(null, '음수 골프장', 'jeju', null, -1, null, null, null, true)$q$,
  'GB422', 'invalid_input', '음수 그린피 거부');
select throws_ok($q$select public.upsert_golf_course(null, '   ', 'jeju', null, null, null, null, null, true)$q$,
  'GB422', 'invalid_input', '빈 이름 거부');
select throws_ok(format($q$select public.upsert_golf_course(%L, 'x', 'jeju', null, null, null, null, null, true)$q$, gen_random_uuid()),
  'GB404', 'not_found', '없는 골프장 수정 거부');
select is((public.upsert_golf_course(:'gid', '새 골프장', 'jeju', '제주시', 110000, 150000, null, null, false)).weekday_green_fee,
  110000::bigint, '골프장 수정');

-- 통화 메모
select n.id as nid, n.body as nbody from public.add_activity_note(:'cust', 'deal', :'did', '  고객 통화: 평일 계약 선호  ') n \gset
select is(:'nbody'::text, '고객 통화: 평일 계약 선호'::text, '거래 메모 작성(공백 제거)');
select throws_ok(format($q$select public.add_activity_note(%L, 'deal', %L, '남의 건')$q$, :'cust', :'odid'),
  'GB422', 'invalid_input', '다른 고객의 거래에 메모 불가');
select throws_ok(format($q$select public.add_activity_note(%L, 'customer', null, '   ')$q$, :'cust'),
  'GB422', 'invalid_input', '빈 메모 거부');

select ok(exists(select 1 from public.list_assignable_staff() s where s.id = :'admin' and s.is_me), '운영자 목록에 본인 포함');
select ok(not exists(select 1 from public.list_assignable_staff() s where s.id = :'cust'), '운영자 목록에 고객 제외');

select tests.clear_authentication();
select is((select count(*)::int from public.audit_logs
            where (entity_type = 'golf_course' and entity_id = :'gid') or (entity_type = 'activity_note' and entity_id = :'nid'::text)), 3,
  '골프장 생성·수정, 메모 작성이 감사 로그에 기록');

select * from finish();
rollback;

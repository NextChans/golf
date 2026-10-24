-- D-88: 부킹 DB 객체가 제거되었고 회원권 핵심 객체는 남아 있다
begin;
select plan(22);

-- 부킹 테이블·enum 없음
select hasnt_table('public', 'booking_requests', 'booking_requests 테이블 없음');
select hasnt_table('public', 'booking_proposals', 'booking_proposals 테이블 없음');
select hasnt_table('public', 'booking_events', 'booking_events 테이블 없음');
select hasnt_enum('public', 'booking_status', 'booking_status 타입 없음');
select hasnt_enum('public', 'proposal_status', 'proposal_status 타입 없음');
select hasnt_enum('public', 'time_pref', 'time_pref 타입 없음');

-- 부킹 함수 없음, 남은 함수 본문도 부킹 테이블을 참조하지 않음
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'app') and p.proname in (
              'create_booking_request', 'assign_booking', 'propose_booking', 'accept_proposal', 'decline_proposal',
              'reject_booking', 'cancel_booking', 'expire_proposals', 'mark_sla_breaches',
              'lock_booking', 'booking_payload', 'booking_event')), 0, '부킹 상태 함수·배치·헬퍼 없음');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'app') and p.prosrc ~ 'booking_(requests|proposals|events)'), 0,
  '남은 함수 본문에 부킹 테이블 참조 없음');

-- 부킹 cron 잡 없음
select is((select count(*)::int from cron.job where jobname in ('expire-proposals', 'mark-sla-breaches')), 0, '부킹 cron 잡 없음');

-- 회원권 핵심 객체는 남는다
select has_table('public', 'golf_courses', 'golf_courses 유지');
select has_table('public', 'membership_products', 'membership_products 유지');
select has_table('public', 'membership_listings', 'membership_listings 유지');
select has_table('public', 'membership_deals', 'membership_deals 유지');
select has_table('public', 'membership_quotes', 'membership_quotes 유지');
select has_enum('public', 'region', 'region 타입 유지(golf_courses)');
select has_function('public', 'create_deal_inquiry', 'create_deal_inquiry 유지');

-- 옛 부킹 rpc는 함수 없음 오류
select tests.create_user('a@test.local') as a \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset
select tests.authenticate_as(:'a', 'aal1');
select throws_ok('select public.cancel_booking(gen_random_uuid(), 1, null)', '42883', null, 'authenticated: 옛 부킹 rpc 호출은 함수 없음');
select tests.authenticate_anon();
select throws_ok('select public.accept_proposal(gen_random_uuid(), gen_random_uuid(), 1)', '42883', null, 'anon: 옛 부킹 rpc 호출은 함수 없음');

-- 공용 함수의 부킹 분기 제거
select tests.authenticate_as(:'admin');
select throws_ok(format($q$select public.add_activity_note(%L, 'booking', gen_random_uuid(), '메모')$q$, :'a'),
  'GB422', 'invalid_input', '부킹 대상 통화 메모는 받지 않는다');
select throws_ok($q$select public.log_pii_view('booking', gen_random_uuid())$q$,
  'GB422', 'invalid_input', '부킹 대상 연락처 열람 기록은 받지 않는다');
select tests.clear_authentication();
select set_config('request.jwt.claims', jsonb_build_object('sub', :'a', 'role', 'authenticated')::text, true);
select throws_ok($q$select app.enforce_rate_limit('booking')$q$, 'GB422', 'invalid_input', 'rate limit 종류에 booking 없음');
select tests.clear_authentication();
select throws_ok(format($q$insert into public.activity_notes (customer_id, subject_type, subject_id, body, author_id)
                          values (%L, 'booking', gen_random_uuid(), 'x', %L)$q$, :'a', :'admin'),
  '23514', null, 'activity_notes.subject_type 제약에 booking 없음');

select * from finish();
rollback;

-- D-48: 연락처 정규화·변경·회원권 상담 전 필수
begin;
select plan(11);

select is(app.normalize_kr_mobile('010-1234-5678'), '+821012345678', '하이픈 번호 정규화');
select is(app.normalize_kr_mobile('01012345678'), '+821012345678', '숫자만 정규화');
select is(app.normalize_kr_mobile('+821012345678'), '+821012345678', 'E.164 유지');
select is(app.normalize_kr_mobile('02-123-4567'), null, '유선번호 거부');
select is(app.normalize_kr_mobile('010-123'), null, '짧은 번호 거부');

select tests.create_user('a@test.local') as a \gset
-- 연락처 없는 온보딩 고객(인증 생략 모드 이전 가입자 가정)
update public.profiles set phone = null, phone_verified_at = null where id = :'a';

select tests.authenticate_as(:'a', 'aal1');
select throws_ok('select tests.new_deal()', 'GB422', 'contact_required', '연락처가 없으면 회원권 상담 신청 불가');
select throws_ok($q$select public.update_contact_phone('123')$q$, 'GB422', 'contact_required', '잘못된 번호는 거부');
select is((public.update_contact_phone('010 9876 5432')).phone, '+821098765432', '연락처 입력');
select isnt((tests.new_deal()).id, null, '연락처 입력 후 회원권 상담 신청 가능');

select tests.clear_authentication();
select is((select after ->> 'phone' from public.audit_logs where entity_id = :'a' and action = 'update_contact'), '+821098765432', '연락처 변경 감사 로그');

-- 인증 필수 모드에서는 직접 변경 불가
update public.app_settings set value = 'true' where key = 'phone_verification_required';
select tests.authenticate_as(:'a', 'aal1');
select throws_ok($q$select public.update_contact_phone('010-1111-2222')$q$, 'GB403', 'forbidden', '인증 필수 모드에서는 직접 변경 불가');

select * from finish();
rollback;

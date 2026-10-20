-- M2: 공개 가입 차단 훅, 온보딩(휴대폰 인증 + 약관), 운영자 판별 강화
begin;
select plan(21);

-- 가입 훅: 카카오만 허용
select is(public.before_user_created_hook('{"user":{"app_metadata":{"provider":"kakao"}}}'), '{}'::jsonb, '카카오 가입 허용');
select is((public.before_user_created_hook('{"user":{"app_metadata":{"provider":"email"}}}') -> 'error' ->> 'http_code')::int, 403, '이메일 자가 가입 거부');
select is((public.before_user_created_hook('{"user":{"app_metadata":{"provider":"phone"}}}') -> 'error' ->> 'http_code')::int, 403, '휴대폰 자가 가입 거부');
select is((public.before_user_created_hook('{}') -> 'error' ->> 'http_code')::int, 403, 'provider 없으면 거부');

select tests.create_kakao_user('k1@test.local', '821000000001') as k1 \gset
select tests.create_kakao_user('k2@test.local') as k2 \gset
select tests.create_email_user('e1@test.local') as e1 \gset

-- 휴대폰 인증 필수 모드(SMS 대행사 계약 후, D-42)
update public.app_settings set value = 'true' where key = 'phone_verification_required';

-- 휴대폰 미인증
select tests.authenticate_as(:'k2', 'aal1');
select throws_ok($q$select public.complete_onboarding('홍길동', array['service','privacy'])$q$, 'GB422', 'phone_not_verified', '휴대폰 인증 전에는 온보딩 불가');

-- 이메일 계정은 고객 온보딩 불가
select tests.authenticate_as(:'e1', 'aal1');
select throws_ok($q$select public.complete_onboarding('이메일', array['service','privacy'])$q$, 'GB403', 'forbidden', '카카오 계정만 고객 온보딩');

select tests.authenticate_as(:'k1', 'aal1');
select throws_ok($q$select public.complete_onboarding('홍길동', array['service'])$q$, 'GB422', 'terms_required', '필수 약관 미동의는 거부');
select throws_ok($q$select public.complete_onboarding('  ', array['service','privacy'])$q$, 'GB422', 'invalid_input', '이름 필수');
select throws_ok('select tests.new_booking()', 'GB403', 'onboarding_required', '온보딩 전 부킹 불가');

select is((public.complete_onboarding('홍길동', array['service','privacy'])).phone, '+821000000001', '온보딩 시 인증된 번호로 프로필 생성');
select isnt((select onboarded_at from public.profiles where id = :'k1'), null, 'onboarded_at 기록');
select is((select count(*) from public.terms_agreements where user_id = :'k1')::int, 2, '동의한 약관만 기록');
select is((public.complete_onboarding('홍길동2', array['service','privacy','marketing'])).display_name, '홍길동2', '재호출 시 갱신(멱등)');

select tests.clear_authentication();
select is((select raw_app_meta_data ->> 'onboarded' from auth.users where id = :'k1'), 'true', 'app_metadata.onboarded 반영');
select is((select count(*) from public.audit_logs where entity_type = 'profile' and entity_id = :'k1')::int, 2, '온보딩 감사 로그');

-- 휴대폰 인증 생략 모드(현재 운영 기본값, D-42): 번호 없이 온보딩
update public.app_settings set value = 'false' where key = 'phone_verification_required';
select tests.authenticate_as(:'k2', 'aal1');
-- D-48: 인증은 생략하되 연락처는 직접 입력(필수, 미인증으로 저장)
select throws_ok($q$select public.complete_onboarding('김철수', array['service','privacy'])$q$, 'GB422', 'contact_required', '생략 모드에서도 연락처는 필수');
select lives_ok($q$select public.complete_onboarding('김철수', array['service','privacy'], '010-2345-6789')$q$, '연락처를 입력하면 온보딩');
select tests.clear_authentication();
select is((select phone || '|' || coalesce(phone_verified_at::text, 'unverified') from public.profiles where id = :'k2'), '+821023456789|unverified', '직접 입력한 번호는 미인증으로 저장');

-- 설정 변경은 owner만(감사 로그)
select tests.create_user('owner9@test.local', 'owner') as owner9 \gset
select tests.authenticate_as(:'k1', 'aal1');
select throws_ok($q$select public.set_app_setting('phone_verification_required', 'true')$q$, 'GB403', 'forbidden', '고객은 설정 변경 불가');
select tests.authenticate_as(:'owner9');
select public.set_app_setting('phone_verification_required', 'true');
select tests.clear_authentication();
select is((select count(*) from public.audit_logs where entity_type = 'app_setting' and action = 'update')::int, 1, '설정 변경 감사 로그');

-- 카카오 계정에 role=admin이 들어가도(DB 직접 조작 가정) 운영자로 인정하지 않는다
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where id = :'k2';
select tests.authenticate_as(:'k2', 'aal2');
select is(app.is_admin(), false, '카카오 identity 세션은 운영자가 될 수 없다');

select * from finish();
rollback;

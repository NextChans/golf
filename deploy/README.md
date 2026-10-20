# 운영(Supabase prod) 반영 가이드

대상 프로젝트: `sacsqmsfwujuuudwjhbp` (서울 리전, D-33). 순서대로 진행한다.

## 1. 스키마 반영 (SQL Editor)

1. Supabase 대시보드 → **SQL Editor** → New query
2. `deploy/2026-10-20-01-initial-schema.sql` 전체를 붙여넣고 **Run** (초기 스키마, 적용 완료 2026-10-20)
   - 한 트랜잭션이라 중간에 실패하면 아무것도 반영되지 않는다
   - 적용 이력을 `supabase_migrations.schema_migrations`에 남기므로, 이후 변경은 `db-deploy` 워크플로(또는 `node scripts/bundle-migrations.mjs --from <다음 버전>`)로 이어서 반영한다
   - 같은 파일을 두 번 실행하면 첫 부분의 검사에서 멈춘다(이중 적용 방지)
3. 확인 쿼리(모두 0이면 정상)
```sql
select count(*) as rls_off from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select count(*) as dml_grants from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
   and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
select jobname from cron.job order by 1;   -- expire-proposals, mark-sla-breaches, purge-idempotency-keys
```

## 1-1. 추가 변경분(순서대로, 한 번씩)

| 파일 | 내용 | 상태 |
|---|---|---|
| `2026-10-20-01-initial-schema.sql` | 마이그레이션 001~008 | 적용 완료 |
| `2026-10-20-02-contact-phone.sql` | 009: 고객 연락처 직접 입력(D-48), 연락처 없는 요청 차단 | **미적용** |

각 파일은 앞부분에서 이미 적용된 버전인지 검사하므로 실수로 두 번 실행해도 멈춘다.
적용 여부 확인: `select version, name from supabase_migrations.schema_migrations order by version;`

## 2. Auth 설정 (대시보드)

| 위치 | 설정 |
|---|---|
| Authentication → **URL Configuration** | Site URL `https://golf-lac-delta.vercel.app`. Redirect URLs에 `https://golf-lac-delta.vercel.app/**`와 preview용 `https://*-babadung-6380s-projects.vercel.app/**` 추가(preview에서 로그인 테스트 시 필수, D-45) |
| Authentication → **Sign In / Providers → Kakao** | Enable, REST API Key, Client Secret Code, **Allow users without an email** 켜기 (완료). 카카오 콘솔 동의항목에 닉네임(필수)·프로필 사진(선택)·카카오계정 이메일(선택) 모두 설정 — 없으면 KOE205 (D-46) |
| Authentication → **Sign In / Providers → Email** | Enable 유지(운영자 로그인용). "Allow new users to sign up"은 켜 둬도 된다 — 공개 가입은 아래 훅이 막는다 |
| Authentication → **Sign In / Providers → Phone** | 끔(D-42, 고객 휴대폰 인증 생략) |
| Authentication → **Auth Hooks → Before User Created** | Hook type: **Postgres**, Schema `public`, Function `before_user_created_hook` → Enable |
| Authentication → **Multi-Factor** | TOTP(App Authenticator) **Enabled** |
| Project Settings → **JWT Keys**(또는 Auth Settings) | Access token expiry **900** 초 |

> Before User Created 훅은 1단계(스키마 반영) 후에만 켤 수 있다(함수가 있어야 함). 훅이 꺼져 있으면 누구나 이메일로 자가 가입할 수 있으므로 반드시 켠다.

## 3. 최초 owner 계정

방법 A (로컬에서 스크립트, 권장)
```bash
OWNER_EMAIL=you@example.com \
NEXT_PUBLIC_SUPABASE_URL=https://sacsqmsfwujuuudwjhbp.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<secret key> \
pnpm seed:owner      # 임시 비밀번호가 한 번 출력된다
```

방법 B (대시보드만 사용)
1. Authentication → Users → **Add user** → Create new user: 이메일·임시 비밀번호 입력, **Auto Confirm User** 체크
2. SQL Editor에서 실행(이메일을 바꿔서)
```sql
update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"password_change_required": true}'::jsonb
 where email = 'you@example.com';
select public.bootstrap_owner((select id from auth.users where email = 'you@example.com'));
```
3. https://golf-lac-delta.vercel.app/admin/login 에서 로그인 → 비밀번호 변경 → OTP 등록

## 4. 골프장 마스터(선택)

운영자 화면의 골프장 관리(M4) 전까지는 고객이 "목록에 없음(직접 입력)"으로 요청할 수 있다. 미리 넣으려면 SQL Editor에서:
```sql
insert into public.golf_courses (name, region, address, weekday_green_fee, weekend_green_fee, cancellation_policy, contact_phone)
values ('실제 골프장명', 'seoul_gyeonggi', '주소', 180000, 240000, '위약 규정', '031-000-0000');
-- region: seoul_gyeonggi | gangwon | chungcheong | jeolla | gyeongsang | jeju
```
※ seed.sql의 "구골프 ○○CC"는 로컬 테스트용 가짜 데이터이므로 운영에 넣지 않는다.

## 5. 동작 확인

1. https://golf-lac-delta.vercel.app → 로그인 → **카카오로 시작하기** → 가입 마무리(이름·약관) → 내 정보
2. 부킹 요청 → 운영자 계정으로 /admin 로그인(제안 화면은 M4)
3. SQL Editor: `select action, entity_type, occurred_at from public.audit_logs order by id desc limit 10;` 으로 감사 로그 기록 확인

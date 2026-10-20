# 런북: 환경 구성 · 명령어 · 자주 쓰는 쿼리

## 1. 로컬 환경 구성

필수: Node 22+, pnpm 10, Docker. Supabase CLI는 devDependency(`pnpm exec supabase`)로 설치된다.

```bash
pnpm install
# 클라우드 컨테이너(Claude Code on the web 등)에서는 Docker 데몬이 꺼져 있다. root로 직접 띄운다.
dockerd > /tmp/dockerd.log 2>&1 &
pnpm db:start            # 첫 실행은 이미지 다운로드로 수 분 소요
pnpm exec supabase status -o env   # 로컬 URL·키 확인 → .env.local에 복사
```

- 로컬 포트: API 54321, DB 54322, Studio 54323, Mailpit 54324
- `config.toml` 조정 사항: `jwt_expiry=900`(D-07), TOTP MFA on(D-06), realtime·analytics off(미사용)
- pnpm이 supabase postinstall을 막지 않도록 `package.json`의 `pnpm.onlyBuiltDependencies`에 supabase가 있다
- TypeScript는 5.9로 고정(7.x는 Next 15 호환 미확인)

## 2. 명령어

| 목적 | 명령 |
|---|---|
| 마이그레이션+seed 재적용 | `pnpm db:reset` |
| pgTAP 전체 | `pnpm db:test` |
| 특정 테스트만 | `pnpm exec supabase test db supabase/tests/003_booking_transitions.test.sql` (000_setup이 먼저 한 번 실행돼 있어야 함) |
| 동시성 | `pnpm test:concurrency` (`ITERATIONS=200`으로 반복 수 조정) |
| 타입 생성 | `pnpm db:types` → `types/database.ts` |
| 타입체크 | `pnpm typecheck` |
| psql 접속 | `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| 새 마이그레이션 | `pnpm exec supabase migration new <설명>` |

## 2-1. 앱 실행

```bash
cp .env.example .env.local   # 값은 `pnpm exec supabase status -o env`의 API_URL/ANON_KEY/SERVICE_ROLE_KEY
pnpm dev                     # http://localhost:3000
OWNER_EMAIL=me@example.com pnpm seed:owner   # 최초 owner(임시 비밀번호 1회 출력) → /admin/login
```

- 로컬 휴대폰 인증: 테스트 번호 `010-0000-0001`~`0003`, 인증번호 `123456`(config.toml `auth.sms.test_otp`)
- 로컬 카카오 로그인은 카카오 앱 키(`SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID/SECRET`)를 셸 env로 주고 `supabase start`해야 동작
- E2E: `pnpm build && pnpm test:e2e`. 3000 포트에 예전 서버가 떠 있으면 먼저 종료(`pgrep -f "next-server"` → `kill <pid>`; `pkill -f "next start"`는 실행 중인 셸까지 죽일 수 있어 쓰지 않는다)

## 3. 에러 코드(SQLSTATE)

| 코드 | message | 의미 | HTTP 매핑(M3 예정) |
|---|---|---|---|
| GB401 | unauthenticated | 로그인 필요 | 401 |
| GB403 | forbidden / onboarding_required / audit_logs is append-only | 권한 없음, 온보딩 미완료 | 403 |
| GB404 | not_found | 없음 또는 남의 데이터 | 404 |
| GB409 | version_conflict / invalid_state / proposal_expired / listing_unavailable / duplicate_inquiry / idempotency_key_reused | 동시성·상태 충돌 | 409 |
| GB422 | invalid_input | 입력 검증 실패(detail에 사유) | 422 |
| GB429 | rate_limited | 10분당 5건 초과 | 429 |
| 42501 | (Postgres) permission denied | 직접 DML 시도 | 403 |

## 4. 자주 쓰는 쿼리

슈퍼유저(psql) 기준. 운영 DB에서는 읽기 전용 쿼리만 실행한다.

```sql
-- 특정 부킹 요청의 전체 이력(감사 로그)
select occurred_at, actor_role, actor_id, action, before->>'status' as from_status, after->>'status' as to_status, host(ip) ip
  from public.audit_logs
 where entity_type = 'booking_request' and entity_id = '<request_id>'
 order by occurred_at;

-- 고객 타임라인(고객에게 보이는 것)
select created_at at time zone 'Asia/Seoul' as kst, from_status, to_status, message
  from public.booking_events where request_id = '<request_id>' order by id;

-- SLA 초과·미배정 요청
select id, created_at at time zone 'Asia/Seoul' as kst, sla_due_at at time zone 'Asia/Seoul' as due_kst
  from public.booking_requests
 where status = 'requested' and first_responded_at is null and sla_due_at < now()
 order by sla_due_at;

-- 만료 대기 중 제안
select p.id, p.request_id, p.expires_at at time zone 'Asia/Seoul' as expires_kst
  from public.booking_proposals p where p.status = 'offered' order by p.expires_at;

-- 매물 선점 상태와 점유 거래
select l.id, l.status, d.id as deal_id, d.status as deal_status
  from public.membership_listings l
  left join public.membership_deals d
    on d.listing_id = l.id and d.status in ('negotiating','contract_scheduled','contracted','transferring');

-- 알림 outbox 적체·실패
select status, count(*), min(next_attempt_at) from public.notification_outbox group by status;
select id, event_type, template_code, attempts, last_error from public.notification_outbox
 where status in ('failed','dead') order by id desc limit 50;

-- cron 잡과 최근 실행 결과
select jobid, jobname, schedule, active from cron.job;
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;

-- 운영자 목록(app_metadata.role)
select id, email, raw_app_meta_data->>'role' as role from auth.users
 where raw_app_meta_data->>'role' in ('admin','owner');

-- RLS가 꺼진 public 테이블이 없는지 점검(0행이어야 정상)
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- API 역할에 DML 권한이 남아 있는지 점검(0행이어야 정상)
select grantee, table_name, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
   and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
```

## 5. 함수를 사용자 권한으로 수동 호출(디버깅)

```sql
begin;
select set_config('request.jwt.claims',
  '{"sub":"<user_id>","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select * from public.assign_booking('<request_id>', '<admin_id>', 1);
rollback;   -- 확인만 하고 되돌린다
```

## 6. 원격 배포(마이그레이션)

1. GitHub 저장소 → Settings → Environments에서 `dev`(필요 시 `prod`) 생성
2. 각 environment에 secrets `SUPABASE_ACCESS_TOKEN`(supabase.com/dashboard/account/tokens), `SUPABASE_DB_PASSWORD`, variable `SUPABASE_PROJECT_REF` 등록. prod에는 Required reviewers 설정
3. Actions → `db-deploy` → Run workflow: 먼저 `dry_run=true`로 적용 대상 확인 → `dry_run=false`로 적용
4. 적용 후 원격 점검: 대시보드 SQL Editor에서 4절의 "RLS 꺼진 테이블", "DML 권한" 점검 쿼리 실행(0행이어야 정상)

- 첫 적용 이후 기존 마이그레이션 파일은 수정 금지. 변경은 `supabase migration new`로 새 파일
- Auth 설정(카카오, MFA, jwt_expiry 등)은 db push로 반영되지 않는다. 대시보드 또는 `supabase config push`(M2에서 정리)

## 7. prod(Supabase 대시보드) Auth 설정 — `config.toml`은 prod에 push하지 않는다

| 항목 | 값 |
|---|---|
| Authentication → URL Configuration → Site URL | `https://golf-lac-delta.vercel.app` |
| Redirect URLs | `https://golf-lac-delta.vercel.app/auth/callback` (preview 쓰면 `https://*-babadung-6380s-projects.vercel.app/auth/callback`) |
| Providers → Kakao | 사용, REST API 키/Client Secret, "Allow users without an email" 켜기 |
| Providers → Email | 사용(관리자 로그인), Confirm email 끄기 불필요(Admin API가 email_confirm=true로 생성) |
| Providers → Phone | SMS 대행사 계약 전까지 끔 → 고객 온보딩 불가(D-25). 켤 때 **Confirm phone 반드시 켜기**(D-39) |
| Auth Hooks → Before User Created | Postgres 함수 `public.before_user_created_hook` |
| Multi-Factor → TOTP | 사용 |
| JWT expiry | 900초(D-07) |
| 카카오 Developers Redirect URI | `https://sacsqmsfwujuuudwjhbp.supabase.co/auth/v1/callback` |

## 8. 트러블슈팅

| 증상 | 원인·조치 |
|---|---|
| `failed to connect to the docker API` | Docker 데몬 미기동 → `dockerd &` |
| `supabase test db`에서 `permission denied for table users` | 테스트 헬퍼가 인증된 상태에서 auth.users 조회 → security definer 헬퍼(`tests.user_role`) 사용 |
| `could not determine polymorphic type because input has type unknown` | pgTAP `is()`에 psql 변수 두 개를 비교 → `:'x'::uuid`처럼 캐스팅 |
| `Bad plan. You planned N tests but ran M` | `select plan(N)` 수 불일치 또는 중간 에러로 중단 |
| CI에서 `git diff --exit-code types/database.ts` 실패 | 스키마 변경 후 `pnpm db:types` 미실행 |
| SVG가 깨져 보임 | XML 주석 안에 `--` 금지 |
| 로그인 후 `localhost`/`127.0.0.1`이 섞이며 세션이 풀림 | 로컬은 `localhost:3000`만 사용(SITE_URL, Playwright baseURL) |
| Server Action 호출 시 "An unexpected response was received from the server" | middleware가 액션 POST를 리다이렉트함 → `next-action` 요청은 리다이렉트 제외(이미 반영) |
| 페이지는 뜨는데 JS 청크 404/MIME 오류 | 예전 빌드로 뜬 서버가 포트를 점유 → 프로세스 종료 후 재기동 |
| `phone_change` 없이 번호가 바로 인증됨 | `[auth.sms] enable_confirmations=false` → 반드시 true(D-39) |
| 클라우드 세션에서 원격 DB 접속 불가 | 컨테이너는 HTTPS 프록시만 허용(5432 차단). `db-deploy` 워크플로 사용 |

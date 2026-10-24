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
select jobname from cron.job order by 1;   -- 초기 스키마 직후: expire-proposals, mark-sla-breaches, purge-idempotency-keys (013 후 notify-dispatch 추가, 017 후 부킹 잡 2개 제거)
```

## 1-1. 추가 변경분(순서대로, 한 번씩)

| 파일 | 내용 | 상태 |
|---|---|---|
| `2026-10-20-01-initial-schema.sql` | 마이그레이션 001~008 | 적용 완료 |
| `2026-10-20-02-contact-phone.sql` | 009: 고객 연락처 직접 입력(D-48), 연락처 없는 요청 차단 | 적용 완료 |
| `2026-10-20-03-admin-ops.sql` | 010: 골프장 저장·통화 메모·배정 대상 목록(M4) | 적용 완료(머지 전 선반영, D-50) |
| `2026-10-20-04-membership-admin.sql` | 011: 회원권 상품·매물·시세 저장, 거래 담당자 배정(M5) | 적용 완료(머지 전 선반영, D-50) |
| `2026-10-20-05-deal-status-label.sql` | 012: 거래 상태 라벨을 화면과 통일(D-61) | 적용 완료(머지 전 선반영) |
| `2026-10-20-09-quotes-source-grant.sql` | 016: 시세 출처 컬럼 조회 권한(015 보완) | 적용 완료(2026-10-24 지시문 기준 운영 001~016 적용) |
| `2026-10-20-08-quotes-auto-pii-log.sql` | 015: 체결가 자동 기록, 시세 일괄 입력, 연락처 열람 기록 — 추가만 | 적용 완료(머지 전 선반영) |
| `2026-10-20-07-community.sql` | 014: 골프 모임 커뮤니티(M7) — 새 테이블·함수만 추가 | 적용 완료(머지 전 선반영) |
| `2026-10-20-06-outbox-dispatch.sql` | 013: 알림 발송(claim·성공·실패·재시도, pg_net, 1분 cron)(M6) | 적용 완료, 발송 켜기 완료(2026-10-20 22:24 UTC 첫 발송 10건) |
| `2026-10-24-01-drop-booking.sql` | 017: **부킹 DB 제거(D-88)** — 부킹 테이블 3·함수 12·cron 2·enum 3 삭제, 부킹 메모·미발송 부킹 알림 삭제, 공용 함수의 부킹 분기 제거. 1-2의 확인 쿼리와 함께 실행 | **미적용 — 되돌릴 수 없음. 오너가 확인 후 SQL Editor에서 실행** |

**순서 규칙(D-50)**: 추가만 하는 변경(새 함수·컬럼·인덱스)은 DB 먼저, 기존 동작을 막는 변경(트리거·제약 강화)은 그 에러를 처리하는 앱을 먼저 배포한 뒤 DB. 각 PR 설명에 어느 쪽인지 적는다.

각 파일은 앞부분에서 이미 적용된 버전인지 검사하므로 실수로 두 번 실행해도 멈춘다.
적용 여부 확인: `select version, name from supabase_migrations.schema_migrations order by version;`

## 1-2. 부킹 DB 제거(`2026-10-24-01-drop-booking.sql`, D-88)

**되돌릴 수 없다.** 부킹 요청·제안·타임라인 행, 부킹 대상 통화 메모, 아직 보내지 않은 부킹 알림이 지워진다(감사 로그 `audit_logs`와 보낸·실패(dead) 알림 이력은 남는다). 필요하면 실행 전에 Dashboard → Database → Backups에서 백업 시점을 확인하거나 아래 "전" 쿼리 결과를 저장해 둔다.

순서(D-50): 앱은 이미 부킹 화면 없이 배포됨(PR #13) → **SQL 실행** → GitHub Actions **functions-deploy**(target=prod, 부킹 템플릿 제거). 두 단계의 순서는 바뀌어도 된다(발송기는 모르는 템플릿을 기본 문구로 보낸다).

실행 **전**(값을 기록해 둔다):
```sql
select version, name from supabase_migrations.schema_migrations where version >= '20261020000016';  -- 016만 있어야 한다
select (select count(*) from public.booking_requests) as requests,
       (select count(*) from public.booking_proposals) as proposals,
       (select count(*) from public.booking_events) as events,
       (select count(*) from public.activity_notes where subject_type = 'booking') as booking_notes;
select status, count(*) from public.notification_outbox
 where event_type like 'booking.%' group by 1 order by 1;   -- pending/failed/sending은 지워지고 sent/dead는 남는다
select jobname from cron.job order by 1;                    -- expire-proposals, mark-sla-breaches, notify-dispatch, purge-idempotency-keys
```

실행: SQL Editor에 파일 전체를 붙여넣고 Run. 결과 창의 NOTICE에 삭제 전 행 수와 정리 건수가 나온다. 한 트랜잭션이라 실패하면 아무것도 바뀌지 않는다(예상 밖 의존 객체가 있으면 cascade 없이 멈춘다 — 오류 메시지를 그대로 공유).

실행 **후**(모두 기대값이어야 정상):
```sql
select count(*) as booking_tables from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('booking_requests', 'booking_proposals', 'booking_events');   -- 0
select count(*) as booking_functions from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app') and p.proname in ('create_booking_request', 'assign_booking', 'propose_booking',
   'accept_proposal', 'decline_proposal', 'reject_booking', 'cancel_booking', 'expire_proposals', 'mark_sla_breaches',
   'lock_booking', 'booking_payload', 'booking_event');                                                         -- 0
select count(*) as booking_types from pg_type t join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public' and t.typname in ('booking_status', 'proposal_status', 'time_pref');               -- 0
select count(*) as booking_cron from cron.job where jobname in ('expire-proposals', 'mark-sla-breaches');      -- 0
select jobname from cron.job order by 1;                                                                     -- notify-dispatch, purge-idempotency-keys
select count(*) as pending_booking_outbox from public.notification_outbox
 where status in ('pending', 'failed', 'sending') and event_type like 'booking.%';                           -- 0
select before from public.audit_logs where entity_type = 'migration' and entity_id = '20261020000017';       -- 1행(정리 내역)
select version, name from supabase_migrations.schema_migrations where version >= '20261020000016' order by 1; -- 016, 017(drop_booking)
```
그 다음 1절 3의 RLS·DML 권한 점검 쿼리(0이어야 정상)와 운영 사이트에서 회원권 목록·상담 신청·운영자 거래 화면이 열리는지 확인한다.

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

M4부터는 운영자 화면 **골프장**(`/admin/courses`)에서 추가·수정한다(감사 로그 기록). 아래 SQL은 화면이 없던 때의 방법으로, 감사 로그가 남지 않으므로 쓰지 않는다:
```sql
insert into public.golf_courses (name, region, address, weekday_green_fee, weekend_green_fee, cancellation_policy, contact_phone)
values ('실제 골프장명', 'seoul_gyeonggi', '주소', 180000, 240000, '위약 규정', '031-000-0000');
-- region: seoul_gyeonggi | gangwon | chungcheong | jeolla | gyeongsang | jeju
```
※ seed.sql의 "구골프 ○○CC"는 로컬 테스트용 가짜 데이터이므로 운영에 넣지 않는다.

## 5. 동작 확인

1. https://golf-lac-delta.vercel.app → 로그인 → **카카오로 시작하기** → 가입 마무리(이름·약관) → 내 정보
2. 회원권 매도 상담 신청(/memberships/sell) → 운영자 계정으로 /admin 로그인 → 회원권 상담 → 협의 시작 → 고객 화면(/deals)에서 단계 확인 (부킹은 D-87·D-88로 제거)
3. SQL Editor: `select action, entity_type, occurred_at from public.audit_logs order by id desc limit 10;` 으로 감사 로그 기록 확인

## 6. 알림 발송 켜기 (M6)

순서대로 한 번만 하면 된다. 비밀값은 채팅·이슈·커밋에 붙이지 않는다.

1. **SQL**: 1-1 표의 `2026-10-20-06-outbox-dispatch.sql` 실행(pg_net 확장, 발송 함수, `notify-dispatch` cron)
2. **함수 배포**: GitHub → Actions → **functions-deploy** → Run workflow(target=prod). Environment `prod`의 `SUPABASE_ACCESS_TOKEN`·`SUPABASE_PROJECT_REF`를 쓴다
3. **공유 비밀값 만들기**: 로컬 터미널에서 `openssl rand -hex 32` → 출력값을 아래 4·5에 **같은 값**으로 넣는다
4. **함수 비밀값**: Supabase Dashboard → Edge Functions → Secrets
   | 이름 | 값 |
   |---|---|
   | `NOTIFY_DISPATCH_SECRET` | 3의 값 |
   | `NOTIFY_SITE_URL` | `https://golf-lac-delta.vercel.app` |
   | `SLACK_WEBHOOK_URL` | Slack(또는 Discord) Incoming Webhook URL. 없으면 비워 둔다(운영자 알림이 로그로만 남음) |
   | `NOTIFY_CUSTOMER_PROVIDER` | `console` (알림톡 대행사 계약 전, D-25) |
5. **Vault(SQL Editor)**: cron이 함수를 부를 주소와 비밀값
   ```sql
   select vault.create_secret('https://sacsqmsfwujuuudwjhbp.supabase.co/functions/v1/notify-dispatcher', 'notify_dispatch_url');
   select vault.create_secret('<3의 값>', 'notify_dispatch_secret');
   ```
6. **확인**(1~2분 뒤)
   ```sql
   select status, count(*) from public.notification_outbox group by 1;          -- pending이 줄고 sent가 늘어야 정상
   select status_code, left(content, 200) from net._http_response order by id desc limit 3;  -- 200 + {"claimed":..}
   ```
   운영자 화면 **알림**(`/admin/notifications`)에서 상태별 건수와 실패 목록을 본다.

   | `net._http_response` | 원인·조치 |
   |---|---|
   | 행 없음 | 보낼 알림이 없으면 호출하지 않는다(정상). Vault 이름 두 개가 있는지 `select name from vault.secrets;` |
   | 404 `NOT_FOUND` | 함수 미배포 또는 Vault URL 오타 |
   | 500 `dispatch secret not configured` | 함수 비밀값 `NOTIFY_DISPATCH_SECRET` 미등록(이름 철자 확인) |
   | 401 `unauthorized` | 함수 비밀값과 Vault `notify_dispatch_secret` 값이 다름. Vault 값을 `select decrypted_secret ...`으로 다시 복사해 붙이고(앞뒤 공백 없이), **functions-deploy를 다시 실행**한다(이미 떠 있는 인스턴스가 예전 값을 쓸 수 있음) |
   | 200 `{"claimed":N,"sent":N,...}` | 정상 |

> 끄기: `select cron.unschedule('notify-dispatch');` (켜기: 마이그레이션 013의 `cron.schedule` 문을 다시 실행)
> 비밀값 교체: 4의 `NOTIFY_DISPATCH_SECRET`과 `vault.update_secret((select id from vault.secrets where name = 'notify_dispatch_secret'), '<새 값>')`을 함께 바꾼다

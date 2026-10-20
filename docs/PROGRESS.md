# 진행 현황 · 인수인계

> 새 세션은 이 파일부터 읽는다. 작업 단위가 끝날 때마다 갱신한다.

- 브랜치: `claude/affectionate-maxwell-vs76ph`. 마일스톤마다 PR 1개, 승인 후 main 머지(M1 = NextChans/golf#1 머지 완료). 머지 후 같은 브랜치를 main에서 다시 시작한다.
- Vercel production: https://golf-lac-delta.vercel.app (리전 icn1)
- 원격 Supabase: **prod(운영)** 프로젝트 `sacsqmsfwujuuudwjhbp`(https://sacsqmsfwujuuudwjhbp.supabase.co, D-33). 개발은 로컬 Supabase. prod 반영은 `db-deploy`(target=prod, 승인자 필수)로만.
  **마이그레이션은 아직 원격 미적용**이라 M1 파일을 수정해도 된다. `db-deploy` 워크플로로 처음 적용한 뒤부터는 기존 파일을 고치지 않고 새 파일로만 변경한다.
- 클라우드 작업 컨테이너는 HTTPS만 나갈 수 있어 원격 Postgres(5432)에 직접 접속할 수 없다. 원격 반영은 GitHub Actions `db-deploy`(수동 실행)로만 한다(D-32).

## 마일스톤 상태

| 마일스톤 | 상태 | 비고 |
|---|---|---|
| M0 계획 | 완료·승인 | docs/PLAN.md, DECISIONS.md |
| M1 스키마·RLS·상태 함수 | 완료·승인 | pgTAP 106/106, 동시성 2×50회, GitHub CI 통과 |
| M2 인증 | **완료, 오너 승인 대기** | pgTAP 145, Vitest 33, Playwright 7 |
| M3 고객 부킹 | 대기 | |
| M4 어드민 부킹·CRM | 대기 | |
| M5 회원권 | 대기 | |
| M6 알림 outbox | 대기 | 무료 단계: console + Slack 웹훅 |
| M7 골프 커뮤니티(후보) | 기획 전 | 요구사항 확정 필요(docs/research/somoim-analysis.md) |

## M1 결과 요약

- 마이그레이션 6개(`supabase/migrations/20261020000001~6`): enum, 16개 테이블, 헬퍼, 부킹 함수 7개, 회원권 함수 6개, RLS·권한·cron
- 상태 함수: create_booking_request, assign_booking, propose_booking, accept_proposal, decline_proposal, reject_booking, cancel_booking, create_deal_inquiry, start_deal, update_deal_terms, advance_deal, cancel_deal, set_listing_visibility
- 배치: app.expire_proposals, app.mark_sla_breaches(1분), 멱등키 정리(매시)
- 테스트: `supabase/tests` 9개 파일 106건, `scripts/concurrency/run.ts`
- 생성물: `types/database.ts`
- CI: `.github/workflows/db.yml`
- 브랜드: `public/brand/googolf-logo.svg`, `googolf-mark.svg`

## M2 결과 요약

- DB: `20261020000007_auth_onboarding.sql` — 가입 차단 훅, 약관 버전, `complete_onboarding`, `set_staff_role`, `list_staff`, `record_auth_event`, `bootstrap_owner`, 카카오 세션 운영자 불인정
- 앱: Next 15 + Tailwind v4 + shadcn/ui. 고객 `/login`(카카오) → `/auth/callback` → `/onboarding`(휴대폰 OTP + 약관) → `/me`. 운영자 `/admin/login` → `/admin/password`(최초) → `/admin/mfa`(TOTP) → `/admin`, owner `/admin/staff`
- 보호: `middleware.ts` + `lib/auth/guards.ts`(서버) 이중 검사, 판단 로직은 `lib/auth/routing.ts`
- 관측: Vercel Analytics(Sentry는 보류, D-34)
- 테스트: pgTAP 12파일 145건, Vitest 5파일 33건, Playwright 7건
- CI: `.github/workflows/web.yml`(lint·typecheck·Vitest, Supabase+build+Playwright)

## (이전) M2 계획

1. Next.js 15 스캐폴드(app router, Tailwind, shadcn/ui), `lib/env.ts`, `lib/supabase/*`
2. `supabase/migrations/..._onboarding.sql`: `complete_onboarding`(약관 버전·휴대폰 인증 확인 → profiles), 프로필 자동 생성 정책, 관리자 역할 부여 함수(서버 전용, 감사 로그)
3. 고객: `/login`(카카오) → `/auth/callback` → `/onboarding`(phone_change OTP, test_otp)
4. 관리자: `/admin/login`(이메일+비밀번호) → MFA 등록/검증 → `/admin`. owner의 계정 발급 화면
5. middleware + 서버 가드, Sentry 설정, Playwright 인증 E2E, CI 확장

## 오너 준비물

| 시점 | 항목 | 비용 |
|---|---|---|
| M2 | 카카오 Developers 앱 생성: REST API 키, Client Secret, Redirect URI `http://127.0.0.1:54321/auth/v1/callback` | 무료 |
| M2 | 최초 owner로 쓸 이메일 주소 | — |
| 보류 | Sentry DSN(D-34) | 무료 |
| M6 | Slack(또는 Discord) Incoming Webhook URL | 무료 |
| 배포 시 | GitHub Environment `prod`: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, variable `SUPABASE_PROJECT_REF=sacsqmsfwujuuudwjhbp`, Required reviewers | 무료 |
| 배포 시 | Vercel 프로젝트 연결 완료(golf). 환경변수는 M2 이후 등록 | 무료(Hobby) |

## M3 전에 오너가 할 일(배포 확인용, 선택)

- Vercel 환경변수(Production): `NEXT_PUBLIC_SITE_URL=https://golf-lac-delta.vercel.app`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(Sensitive)
- Vercel → Analytics 탭에서 Web Analytics 사용 설정
- Supabase prod 대시보드 Auth 설정(RUNBOOK 7절), `db-deploy`로 마이그레이션 반영 후 `pnpm seed:owner`(prod 키로 로컬 실행)

## 출시 전 유료 전환 체크리스트 (D-25)

- [ ] SMS 대행사(휴대폰 OTP) + 발신번호 사전등록
- [ ] 카카오톡 채널 + 알림톡 대행사 계약 + 템플릿 심사
- [ ] Supabase Pro(일시정지 없음, 백업·PITR)
- [ ] Vercel Pro(Hobby는 상업적 이용 불가)
- [ ] 로고 아웃라인(path) 버전 교체(D-27)
- [ ] 법률 자문: 회원권 중개 표시·고지(D-16), 개인정보 보관기간(D-21)

## 알려진 리스크

- outbox 발송은 at-least-once. 발송 후 상태 기록 전에 장애가 나면 재발송 가능(M6에서 lease + dedupe로 완화)
- IP/UA는 위조 가능한 참고값(D-09)
- 운영자 역할 회수는 최대 JWT 만료(15분)까지 지연(M2에서 세션 강제 종료 추가)

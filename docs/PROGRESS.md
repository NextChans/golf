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
| M2 인증 | 완료·머지(NextChans/golf#2) | pgTAP 145, Vitest 33, Playwright 7 |
| M3 고객 부킹 | 완료·머지(NextChans/golf#3) | pgTAP 150, Vitest 78, Playwright 12 |
| 디자인 개선(apple.com 스타일 + apple-design 스킬) | 완료·머지 | D-43 |
| 연락처 입력(D-48) | 완료·머지(NextChans/golf#5) | |
| M4 어드민 부킹·CRM | 완료·머지(NextChans/golf#6) | pgTAP 177, Vitest 120, Playwright 23. D-49~52 |
| M5 회원권 | 완료·머지(NextChans/golf#7) | pgTAP 194, Vitest 158, Playwright 36. D-53~62 |
| M6 알림 outbox | 완료·머지(NextChans/golf#8) | D-63~66 |
| M7 골프 모임 커뮤니티 | **완료, 오너 승인 대기** | pgTAP 260, Vitest 201, Playwright 42. D-67~73 |

## M1 결과 요약

- 마이그레이션 6개(`supabase/migrations/20261020000001~6`): enum, 16개 테이블, 헬퍼, 부킹 함수 7개, 회원권 함수 6개, RLS·권한·cron
- 상태 함수: create_booking_request, assign_booking, propose_booking, accept_proposal, decline_proposal, reject_booking, cancel_booking, create_deal_inquiry, start_deal, update_deal_terms, advance_deal, cancel_deal, set_listing_visibility
- 배치: app.expire_proposals, app.mark_sla_breaches(1분), 멱등키 정리(매시)
- 테스트: `supabase/tests` 9개 파일 106건, `scripts/concurrency/run.ts`
- 생성물: `types/database.ts`
- CI: `.github/workflows/db.yml`
- 브랜드: `public/brand/googolf-logo.svg`, `googolf-mark.svg`

## 운영 반영 상태

- 운영 DB: 001~014 적용 완료(오너, 2026-10-20). 013(M6)도 적용 완료, 운영 발송 켜짐(2026-10-20, 함수 배포·비밀값·Vault, 고객 채널은 console). 절차·장애 대응은 `deploy/README.md` 6장. 010(M4)도 적용 완료(`deploy/2026-10-20-03-admin-ops.sql`, 머지 전 선반영). 절차·상태는 `deploy/README.md` 1-1
- 운영 데이터 정리 필요: `golf_courses`의 README 예시 행 "실제 골프장명" — M4 배포 후 골프장 화면에서 수정하거나 운영 중지
- 카카오 앱·Supabase Kakao provider 설정: 오너 완료(2026-10-20)

## M4 결과 요약

- DB: `20261020000010_admin_ops.sql` — `upsert_golf_course`, `add_activity_note`, `list_assignable_staff`, `profiles_phone_idx`. pgTAP `013_admin_ops`
- 화면: `/admin`(신규·내 담당·SLA 카운트), `/admin/bookings`(인박스 탭, D-51), `/admin/bookings/[id]`(배정·제안·불가·취소·제안 이력·타임라인), `/admin/courses`, `/admin/customers`
- 도메인: `lib/domain/booking/admin.ts`(버튼 노출 규칙·KST 변환·zod), `lib/domain/course`, `lib/domain/crm`
- E2E 픽스처: `e2e/staff.ts` — 운영자 계정은 profiles 행까지 만들어야 한다(배정·메모 FK)
- 에러 대체(D-49): 프론트가 모르는 GB 코드는 SQLSTATE 계열 메시지로

## M3 결과 요약

- 화면: `/bookings`(목록·빈/로딩/에러), `/bookings/new`(요청 폼), `/bookings/[id]`(상세·타임라인·제안 카드·취소, 남의 예약은 404)
- 액션: `app/(customer)/bookings/actions.ts` — createBooking/acceptProposal/declineProposal/cancelBooking(모두 requireCustomer → zod → rpc)
- 도메인: `lib/domain/booking/{schema,status,money}.ts` (+ 테스트 45건)
- 설정 플래그: `app_settings.phone_verification_required`(D-42)
- E2E 픽스처: `e2e/customer.ts` — 카카오 온보딩 고객을 DB로 재현하고 @supabase/ssr 쿠키로 로그인, 운영자 제안 시드
- 주의: `/bookings/[id]`에는 loading.tsx를 두지 않는다(스트리밍이 먼저 시작되면 notFound가 200이 됨). 목록 로딩은 `(list)` route group에 둔다

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

- outbox 발송은 at-least-once. 발송 후 상태 기록 전에 장애가 나면 lease(5분) 만료 뒤 최대 1회 재발송 가능(D-66). 알림톡 연동 시 dedupe_key를 대행사 멱등키로
- IP/UA는 위조 가능한 참고값(D-09)
- 운영자 역할 회수는 최대 JWT 만료(15분)까지 지연(M2에서 세션 강제 종료 추가)
- D-62: loading.tsx(또는 `<Suspense>`) 아래에서 같은 화면을 다시 그리는 전환이 운영 빌드에서 멈춘다. 운영자 회원권 목록은 경계를 없애 해결(admin-memberships 20/20). 운영자 골프장 목록·고객 bookings/deals/memberships 목록도 loading.tsx가 있어 같은 위험이 있다(골프장 목록에서 router.refresh 재현). 지금은 그 화면들에서 제자리 갱신을 하지 않아 E2E는 통과한다. 화면에 제자리 갱신을 넣거나 Next를 올릴 때 다시 확인한다
- E2E 데이터 누적: 로컬 DB에 테스트 데이터가 계속 쌓인다. 테스트는 각자 만든 id·고유 호가로만 확인하도록 작성한다(membership.spec 시드 확인은 시드 호가로만 거름). 느려지면 `pnpm db:reset`

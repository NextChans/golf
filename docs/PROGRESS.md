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
| M7 골프 모임 커뮤니티 | 완료·머지(NextChans/golf#10) | pgTAP 260, Vitest 201, Playwright 42. D-67~73 |
| M8 후보 1차: 회원권 앱 개편(그린판다 벤치마크, 목업) | **완료, 오너 검토 대기** | `/market` 22개 화면(가입 4 포함) + 가입 2·3단계(`/onboarding`), Vitest +31, Playwright +10. D-80·D-81·D-82, docs/DESIGN-APP.md |
| 루트 전환·부킹 화면 제거(D-87) | 완료·머지(NextChans/golf#13) | `/` = 앱 홈(URL 유지), `/market`·`/bookings/**`·`/admin/bookings/**` redirect. 부킹 DB는 D-88로 제거. pgTAP 275(불변), Vitest 218(부킹 테스트 제거로 268→218), Playwright 73(부킹 9 삭제, 루트 7 추가) |
| 부킹 DB 제거(D-88) | **완료, 오너 검토·운영 반영 대기** | 마이그레이션 017(테이블 3·함수 12·cron 2·enum 3 제거, 공용 함수 부킹 분기 제거). pgTAP 269(003 삭제 −24, 007 12→8, 018 +22, 나머지 소재를 회원권 거래로 교체), 동시성 3×50회, Vitest 222, Playwright 73. 운영 반영 `deploy/2026-10-24-01-drop-booking.sql` + `functions-deploy` |

## M8 후보 1차 결과 요약(회원권 앱, D-80)

- 경로: `/market`(홈 구매·판매 탭, 팝업), `/market/search`(+results), `/market/items/[id]`, `/market/my`, `/market/mypage`(+favorites·coupons·asks·asks/new·trades·settings·support), `/market/report`, `/market/notifications`, `/market/notices/fee`, `/market/guide/guarantee`, `/market/welcome`
- 가입·로그인(D-81): `/market/login`(카카오만) → `/market/signup`(개인·기업) → 개인은 카카오 → `/onboarding`, 기업은 사업자번호 검증 → 카카오. 콜백이 온보딩 전 고객을 `/onboarding?next=`로 보낸다
- 가입 2·3단계(D-82): `/onboarding`을 앱 스타일로(이름 카카오 닉네임 미리 채움·연락처·약관 → 같은 페이지 환영 화면 "{이름}님, 환영합니다!"·혜택 카드 → "회원권 둘러보기"). Vitest +6, Playwright +2(`e2e/onboarding.spec.ts`)
- 홈 구매 탭 개편(D-83): 고정 헤더, 카드 목록 5건+더보기, 최근 확인한 회원권(localStorage), 지역 원형 타일, 프로모 캐러셀 "n/4", 친구 초대 카드(공유 링크는 `/market`뿐), 회사 정보 푸터(`lib/company.ts` 전부 "(준비 중)" — 오너 값 필요). Vitest +5, Playwright +7
- 상세 개편(D-85): `/market/items/[id]`를 사진·요약·가격 카드·고정 탭 4개·시세 차트·거래 표·회원권/이용/골프장 정보·계산기·FAQ·떠 있는 버튼·하단 CTA로 전면 개편(`components/market/detail/*`, 가상 데이터는 시드 생성). 홈·루트·GlobalNav 불변. Vitest +14, Playwright +10(기존 2건 최소 수정). 참고 구조 정리: `docs/research/greenpanda-reference.md`
- 앱 폰트(D-86): `/market/**`·`/onboarding`만 Pretendard Variable 셀프호스팅(`public/fonts/pretendard`, OFL 동봉), 굵기 800 → 700/600 정리, 루트·기존 화면 폰트 불변, `e2e/font.spec.ts`
- 모두 목업 데이터(`lib/mock/market.ts`). 로그인 판단만 실제 세션을 쓴다(마이페이지 이름, 나의 회원권, 판매 희망가). 판매 희망가 등록은 서버로 보내지 않는다(미리보기)
- 기존 화면과 연결: 개인정보 → `/me`, 판매·구매 관리 → `/deals`, 구매 상담 → `/memberships`, 실제 매도 상담 → `/memberships/sell`
- 다음(오너 결정 후): ① 그린판다 추가 캡처(상세·검색 결과·판매 등록·알림·로그인)로 화면 맞춤 ② 실데이터 연결(`membership_quotes` 주간 시세, 매물 최저가=즉시 구매가, 관심 회원권·알림 설정 테이블) ③ ~~홈(`/`)을 앱 구조로 전환~~ → D-87 완료(GlobalNav는 부킹 링크만 뺀 apple 스타일 유지) ④ 지역 사진 에셋 ~~⑤ 부킹 DB(테이블·함수·알림 템플릿) 삭제 여부~~ → D-88 제거(운영 반영 대기)

## 루트 전환·부킹 화면 제거 결과 요약(D-87)

- 루트(`/`): `app/page.tsx`가 `MarketHomeScreen`(`components/market/home-screen.tsx`, 예전 `app/market/(tabs)/page.tsx`)을 `MarketShell`(폰트 preload·미리보기 띠, `app/market/layout.tsx`와 공용)·`TabBar`로 감싸 URL 그대로 렌더. 홈 링크는 `/?tab=sell`·`/?list=…`, 앱 화면의 뒤로·로고·환영 화면 기본 이동·초대 공유 주소는 `/`
- redirect(307, `next.config.ts`): `/market` → `/`(쿼리 유지), `/bookings`·`/bookings/**` → `/`, `/admin/bookings`·`/admin/bookings/**` → `/admin`
- 제거(코드·화면·테스트): `app/(customer)/bookings/**`, `app/(admin)/admin/(console)/bookings/**`, `lib/domain/booking/**`, `e2e/booking.spec.ts`·`e2e/admin-booking.spec.ts`, `e2e/customer.ts`의 `seedProposal`·`getBookingStatus`, 운영자 홈 부킹 카드·"요청 인박스", 고객 상세 부킹 이력, GlobalNav "부킹"·"내 예약", `/me`의 "내 예약 보기"(→ "내 거래 보기")
- 이동: `formatWon` → `lib/format/money.ts`, `todayKst`·`kstLocalToIso`·`isoToKstLocal` → `lib/format/kst.ts`, `fieldErrors` → `lib/domain/form.ts`
- 부킹 DB는 이 단계에서는 남겨 뒀고, 이후 D-88로 제거했다(아래 "부킹 DB 제거 결과 요약")
- E2E: `e2e/root.spec.ts`(+7), `navigation.spec` 재작성, `contact.spec`은 매도 상담으로 이동, `market`·`font`·`onboarding`·`membership`·`community`·`auth` 스펙을 새 주소에 맞춤

## 부킹 DB 제거 결과 요약(D-88)

- 마이그레이션 `supabase/migrations/20261020000017_drop_booking.sql`(cascade 없음, 한 트랜잭션): cron `expire-proposals`·`mark-sla-breaches` 해제 → 부킹 메모·미발송 부킹 알림(pending/failed/sending)·부킹 멱등키 삭제(내역은 `audit_logs` entity_type `migration` 1건) → `add_activity_note`·`log_pii_view`·`app.enforce_rate_limit`에서 부킹 분기 제거, `activity_notes.subject_type` 제약 customer·deal → 부킹 함수 12개 → 테이블 3개 → enum 3개
- 유지: `audit_logs` 전부, 부킹 알림 sent·dead 이력, `golf_courses`·`region`, 범용 헬퍼(`app.invalid_state`·`app.today_kst`·`app.business_sla_due`·`business_holidays`)
- 업그레이드 경로 검증: 016 상태에 옛 함수로 부킹 데이터(요청 5·제안 3·이벤트 14·알림 20·메모·연락처 열람)와 회원권·모임 데이터를 만든 뒤 운영 반영 SQL을 psql로 실행 → 성공, 부킹 외 테이블 해시 동일. 로컬 전용 헬퍼 `tests.new_booking`이 남아 있으면 drop이 막혀 전체 롤백되는 것도 확인(이후 마이그레이션이 그 헬퍼를 먼저 지움)
- 앱·함수: Edge Function 템플릿에서 부킹 12개 제거(재배포 필요), `lib/domain/crm` 대상 customer·deal, `lib/admin/pii.ts` 타입, 에러 코드 `proposal_expired` 제거, `types/database.ts` 재생성(부킹 제거분만 diff)
- 테스트: pgTAP 003 삭제, 001·002·005·006·007·008·009·012·013·015를 회원권 거래 소재로 교체, `018_booking_removed` 추가. 동시성 (f)를 같은 거래 동시 전이로 교체, (h)는 이전 실행이 남긴 lease 만료 행에 영향받지 않게 정리

## M1 결과 요약

- 마이그레이션 6개(`supabase/migrations/20261020000001~6`): enum, 16개 테이블, 헬퍼, 부킹 함수 7개, 회원권 함수 6개, RLS·권한·cron
- 상태 함수: create_booking_request, assign_booking, propose_booking, accept_proposal, decline_proposal, reject_booking, cancel_booking, create_deal_inquiry, start_deal, update_deal_terms, advance_deal, cancel_deal, set_listing_visibility
- 배치: app.expire_proposals, app.mark_sla_breaches(1분), 멱등키 정리(매시)
- 테스트: `supabase/tests` 9개 파일 106건, `scripts/concurrency/run.ts`
- 생성물: `types/database.ts`
- CI: `.github/workflows/db.yml`
- 브랜드: `public/brand/googolf-logo.svg`, `googolf-mark.svg`

## 운영 반영 상태

- **운영 반영 대기: 2026-10-24-01 부킹 DB 제거**(017, 되돌릴 수 없음 — `deploy/README.md` 1-1의 실행 전·후 확인 쿼리와 함께 오너가 SQL Editor에서 실행) + Actions `functions-deploy`(부킹 템플릿 제거)
- 운영 DB: 001~016 적용 완료(오너). 013(M6)도 적용 완료, 운영 발송 켜짐(2026-10-20, 함수 배포·비밀값·Vault, 고객 채널은 console). 절차·장애 대응은 `deploy/README.md` 6장. 010(M4)도 적용 완료(`deploy/2026-10-20-03-admin-ops.sql`, 머지 전 선반영). 절차·상태는 `deploy/README.md` 1-1
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
- D-62: loading.tsx(또는 `<Suspense>`) 아래에서 같은 화면을 다시 그리는 전환이 운영 빌드에서 멈춘다. 운영자 회원권 목록은 경계를 없애 해결(admin-memberships 20/20). 운영자 골프장 목록·고객 deals/memberships 목록도 loading.tsx가 있어 같은 위험이 있다(골프장 목록에서 router.refresh 재현). 지금은 그 화면들에서 제자리 갱신을 하지 않아 E2E는 통과한다. 화면에 제자리 갱신을 넣거나 Next를 올릴 때 다시 확인한다
- E2E 데이터 누적: 로컬 DB에 테스트 데이터가 계속 쌓인다. 테스트는 각자 만든 id·고유 호가로만 확인하도록 작성한다(membership.spec 시드 확인은 시드 호가로만 거름). 느려지면 `pnpm db:reset`

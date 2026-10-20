# 구현 계획 (M0 승인본, 이후 결정 반영)

마일스톤 정의 원문은 BRIEF.md, 결정은 DECISIONS.md, 진행 상태는 PROGRESS.md.

## M1. 스키마 · RLS · 상태 함수 — 완료
상세는 PROGRESS.md "M1 결과 요약".

## M2. 인증 (F-01)
- 파일
  - `app/layout.tsx`, 브랜드 헤더(로고)
  - `app/(customer)/login/page.tsx`(카카오), `app/auth/callback/route.ts`, `app/(customer)/onboarding/{page.tsx,actions.ts}`
  - `app/(admin)/admin/login/page.tsx`(이메일+비밀번호, D-26), `app/(admin)/admin/mfa/{enroll,verify}/page.tsx`, `app/(admin)/admin/layout.tsx`
  - `app/(admin)/admin/staff/{page.tsx,actions.ts}` — owner가 운영자 계정 발급·역할 변경·비활성화
  - `middleware.ts`, `lib/supabase/{server,client,admin}.ts`, `lib/auth/guards.ts`, `lib/env.ts`
  - `supabase/migrations/..._onboarding.sql`: `complete_onboarding`, `app.log_role_change`
  - `scripts/seed-owner.ts`, Sentry(`instrumentation.ts`, `sentry.*.config.ts`)
- 완료 기준: 카카오→온보딩→프로필, 관리자 이메일 로그인→TOTP→/admin, aal1 차단, owner의 운영자 지정
- 테스트: Vitest(guards, env), pgTAP(onboarding, 역할 변경 감사, 카카오 계정 관리자 승격 차단), Playwright(미인증 /admin → /admin/login, 고객 /admin → 403, aal1 관리자 → MFA, 온보딩 미완료 → /onboarding)

## M3. 고객 부킹 (F-02, F-03)
- 파일: `app/(customer)/bookings/{page,new/page,[id]/page,actions,loading,error}.tsx`, `components/booking/*`, `lib/domain/booking/{schema,status,queries}.ts`, `lib/domain/errors.ts`(GB 코드 매핑), `lib/format/{kst,money,phone}.ts`
- 완료 기준: 요청·수락·거절·취소, 서버 시각 기준 만료 카운트다운, 로딩/빈/에러 상태
- 테스트: Vitest(스키마, 포맷, 에러 매핑), Playwright(생성→시드 제안→수락→confirmed, 중복 제출 1건)

## M4. 어드민 부킹 · CRM (A-01, A-02, A-03, A-06)
- 파일: `app/(admin)/admin/{page(인박스),bookings/[id],courses,customers/[id]}`, `components/admin/*`, `lib/domain/booking/admin-queries.ts`, 마이그레이션(`upsert_golf_course`, `add_activity_note`)
- 완료 기준: 인박스 필터 3종, 배정·제안·거절, 골프장 CRUD, 고객 이력·메모, 목록 쿼리 1회(N+1 없음), 전화번호 마스킹
- 테스트: pgTAP(골프장·메모 함수 감사), Playwright(배정→제안→고객 수락)

## M5. 회원권 (F-04, F-05, F-06, A-04, A-05)
- 파일: `app/(customer)/memberships/*`, `app/(customer)/deals/*`, `app/(admin)/admin/memberships/*`, `lib/domain/membership/*`, 마이그레이션(`upsert_product`, `upsert_listing`, `add_quote`)
- 테스트: pgTAP(매물·시세 함수), Playwright(상담→negotiating·reserved→취소→listed)

## M6. 알림 outbox (N-01, N-02)
- 파일: 마이그레이션(`claim_outbox` SKIP LOCKED + lease, `mark_sent`, `mark_failed` 백오프 2^n분·5회 후 dead + 운영자 알림, pg_net cron), `supabase/functions/notify-dispatcher/index.ts`, `lib/notify/{adapter,console,alimtalk,sms,slack,dispatch}.ts`
- 테스트: pgTAP(재시도→dead, 동시 claim 중복 없음, lease 만료 재claim), Vitest(알림톡 실패→SMS 대체)

## M7. 골프 커뮤니티 (후보, D-28)
- 소모임형 모임 개설·운영, 골프 관련 모임만 허용
- 조사: docs/research/somoim-analysis.md. 범위·우선순위는 오너와 확정 후 PRD 부록으로 작성

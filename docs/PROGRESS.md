# 진행 현황 · 인수인계

> 새 세션은 이 파일부터 읽는다. 작업 단위가 끝날 때마다 갱신한다.

- 브랜치: `claude/affectionate-maxwell-vs76ph` (PR: https://github.com/NextChans/golf/pull/1, draft)
- 원격 Supabase: **아직 없음**(로컬만). 마이그레이션은 원격 미적용이라 M1 파일을 수정해도 된다. 원격에 처음 적용한 뒤부터는 새 파일로만 변경한다.

## 마일스톤 상태

| 마일스톤 | 상태 | 비고 |
|---|---|---|
| M0 계획 | 완료·승인 | docs/PLAN.md, DECISIONS.md |
| M1 스키마·RLS·상태 함수 | **완료, 오너 승인 대기** | pgTAP 106/106, 동시성 2×50회 |
| M2 인증 | 대기 | D-26 관리자 이메일+TOTP 반영 |
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

## 다음에 할 일 (M2, 승인 후)

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
| M2 | (선택) Sentry 무료 계정 DSN | 무료 |
| M6 | Slack(또는 Discord) Incoming Webhook URL | 무료 |
| 배포 시 | Supabase 무료 프로젝트 2개(dev/prod), Vercel Hobby | 무료(제약 있음) |

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

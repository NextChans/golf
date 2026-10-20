# 오너 지시문 원문

다른 세션·다른 LLM이 이어받을 때 해석 차이가 없도록 오너의 지시를 **원문 그대로** 보존한다.
이후 대화에서 추가·변경된 지시는 아래 "추가 지시" 절에 시간순으로 붙인다. 해석과 결정은 DECISIONS.md에 둔다.

---

## 1. 구현 지시 (2026-10-20)

> 너는 이 프로젝트의 시니어 풀스택 엔지니어다. docs/PRD.md를 끝까지 읽고 MVP(P0) 범위를 구현한다.
> 작업은 아래 마일스톤 순서로 진행한다. 각 마일스톤이 끝나면 멈추고 보고한 뒤, 내 승인을 받고 다음으로 넘어간다.
>
> [스택]
> - Next.js 15 App Router + TypeScript strict, Tailwind, shadcn/ui, zod, pnpm
> - Supabase: Postgres, Auth(카카오 OAuth + Phone OTP), Storage, pg_cron, Edge Functions
> - 배포: Vercel(preview/production). Supabase 프로젝트는 dev/prod로 분리
> - 세션: @supabase/ssr 쿠키 세션. service_role 키는 서버 전용(NEXT_PUBLIC_ 금지)
> - 테스트: pgTAP(DB), Vitest(단위), Playwright(E2E)
> - 관측: Sentry
>
> [디렉터리]
> - app/(customer), app/(admin)/admin, app/api
> - lib/domain/{booking,membership}: 도메인 로직. UI와 분리한다
> - lib/supabase/{server,client,admin}.ts
> - supabase/migrations, supabase/tests, supabase/functions
> - types/database.ts: supabase gen types로 생성
>
> [절대 규칙 — 모든 마일스톤 공통]
> 1. 상태 전이는 Postgres 함수로만 한다. 함수는 security definer로, search_path를 고정한다.
>    PRD 상태 머신에 없는 전이는 예외를 던진다. 클라이언트의 status 직접 update는 RLS로 막는다.
> 2. 모든 테이블은 RLS를 켜고 기본 거부로 둔다. 고객은 user_id = auth.uid() 행만 접근한다.
>    운영자 판별은 auth.jwt()->'app_metadata'->>'role'만 쓴다. user_metadata는 쓰지 않는다.
> 3. 상태 변경 함수는 같은 트랜잭션에서 audit_logs와 notification_outbox에 기록한다.
>    audit_logs는 append-only다. 모든 역할에서 update/delete 권한을 revoke한다.
> 4. 데이터 변경은 Server Action → zod 검증 → supabase.rpc(상태함수) 경로로만 한다.
>    생성·수락 액션은 Idempotency-Key로 중복 제출을 막는다.
> 5. 금액은 bigint(원), 시간은 timestamptz로 저장하고 KST로 표시한다.
> 6. 주민번호, 인감, 신분증은 수집하지 않는다. 서류는 private bucket에 두고 TTL 5분 signed URL로 제공하며, 열람 이력을 감사 로그에 남긴다.
> 7. 어드민 경로는 middleware와 서버 컴포넌트 양쪽에서 role을 검사한다.
> 8. 비밀값을 하드코딩하지 않는다. .env.example에 필요한 키를 모두 문서화한다.
> 9. 모바일 우선 UI로 만든다. 로딩, 빈 상태, 에러 상태를 모두 구현한다. 휴대폰 번호는 목록에서 마스킹한다.
> 10. 테스트가 통과하지 않으면 마일스톤 완료가 아니다. 테스트를 삭제하거나 skip해서 통과시키지 않는다.
>
> [M0. 계획 — 코드 작성 금지]
> - M1~M6 각각에 대해 생성 파일 목록, 완료 기준, 테스트 목록을 정리하라.
> - PRD에서 모호하거나 결정이 필요한 항목을 나열하고, 각 항목에 기본값을 제안하라.
> - 외부 준비물(카카오 앱 키, 알림톡 대행사 키, Sentry DSN 등) 체크리스트를 만들어라.
>
> [M1. 스키마 · RLS · 상태 함수]
> - PRD '상태 머신과 데이터 모델'의 테이블을 모두 migration으로 작성한다.
>   enum 타입, FK, 인덱스, updated_at 트리거를 포함한다.
> - booking_proposals에 partial unique index를 둔다: (request_id) WHERE status='accepted'.
> - booking_requests에는 version 컬럼을 두어 낙관적 락에 쓴다.
> - 상태 함수를 작성한다: assign_booking, propose_booking, accept_proposal, decline_proposal,
>   reject_booking, cancel_booking, start_deal, advance_deal, cancel_deal.
>   각 함수는 호출자 권한, 현재 상태, version을 검증한다.
> - 매물 선점은 NEGOTIATING 진입 시 조건부 update(WHERE status='listed')로 한다. 영향 행이 0이면 예외를 던진다.
>   cancel_deal은 같은 트랜잭션에서 매물을 listed로 복원하고, COMPLETED 시 매물은 sold가 된다.
> - pg_cron 잡(1분 주기)을 만든다: 만료된 proposal을 expired로 바꾸고 요청을 IN_REVIEW로 되돌린다. SLA 초과 건도 표시한다.
> - pgTAP 테스트:
>   (a) 고객 간 데이터 격리
>   (b) 고객이 status를 직접 update할 수 없음
>   (c) 허용되지 않은 전이 실패
>   (d) audit_logs 수정·삭제 불가
>   (e) 상태 변경 시 audit_logs와 outbox 행 생성
> - 동시성 테스트: 두 커넥션으로 병렬 호출하는 Node 스크립트를 작성한다.
>   (f) 같은 요청에 대한 동시 accept는 1건만 성공
>   (g) 같은 매물에 대한 동시 선점은 1건만 성공
> - 완료 조건: supabase db reset && supabase test db 통과, 동시성 스크립트 통과, types/database.ts 생성.
>
> [M2. 인증 (F-01)]
> - 카카오 OAuth 로그인 → 최초 로그인 시 Phone OTP 인증과 약관 동의 → profiles 생성.
> - role은 app_metadata로 관리한다. owner가 운영자를 지정하는 서버 전용 함수를 둔다.
> - middleware로 보호 경로를 처리한다. 운영자 계정은 MFA를 강제한다.
> - E2E: 미인증 사용자의 /admin 접근 차단, 고객 role의 /admin 접근 차단.
>
> [M3. 고객 부킹 (F-02, F-03)]
> - 부킹 요청 폼(골프장, 날짜, 시간대, 인원, 예산, 요청사항), 내 예약 목록, 상태 타임라인.
> - 제안 수락·거절, 고객 취소. 제안 만료까지 남은 시간 표시.
> - 사용자별 rate limit: 10분당 5건.
> - E2E: 요청 생성 → (어드민 시드로 제안) → 수락 → CONFIRMED.
>
> [M4. 어드민 부킹 · CRM (A-01, A-02, A-03, A-06)]
> - 요청 인박스: 신규, 내 담당, SLA 초과 필터와 담당자 배정.
> - 제안 작성(티타임, 그린피, 유효시간), 거절 사유 입력.
> - 골프장 마스터 CRUD. 고객 상세에 부킹·거래 이력과 통화 메모(activity_notes).
> - E2E: 운영자가 배정 → 제안 → 고객 수락까지 전체 흐름.
>
> [M5. 회원권 (F-04, F-05, F-06, A-04, A-05)]
> - 매물 리스트와 상세, 지역·가격 필터, 상담 신청.
> - 내 거래 진행 단계 조회. 어드민 거래 타임라인(단계 변경, 합의가, 메모).
> - 매물·시세 등록과 수정.
> - E2E: 상담 신청 → NEGOTIATING(매물 reserved) → 취소 시 listed 복원.
>
> [M6. 알림 outbox (N-01, N-02)]
> - Edge Function이 notification_outbox를 폴링해 발송한다(pg_cron 1분 주기).
>   처리 중인 행은 FOR UPDATE SKIP LOCKED로 잡는다.
> - 지수 백오프로 최대 5회 재시도하고, 그래도 실패하면 dead 상태로 두고 운영자에게 알린다.
> - 알림톡 대행사는 어댑터 인터페이스 뒤로 숨긴다. 개발 환경은 콘솔 출력 어댑터를 쓴다. 알림톡 실패 시 SMS로 대체 발송한다.
> - 신규 요청 발생 시 운영자 알림.
> - 테스트: 발송 실패 → 재시도 → dead 전이. 중복 발송 없음.
>
> [마일스톤 종료 시 보고 형식]
> 1. 구현한 기능 ID와 변경 파일 요약
> 2. 테스트 결과(명령어와 통과 수)
> 3. 셀프 코드 리뷰 결과: 보안, 정합성, N+1, 에러 처리, 감사 로그 누락 여부. 발견한 문제는 수정 후 보고
> 4. 남은 리스크와 다음 마일스톤에서 결정이 필요한 사항
>
> 지금 M0부터 시작하라.

## 2. 추가 지시 (시간순)

| 일자 | 원문 | 반영 |
|---|---|---|
| 2026-10-20 | "지금은 무료 환경에서만 진행하고싶은데. 꼭 카카오가 필요해?" | D-25 무료 단계 운영 |
| 2026-10-20 | (관리자 로그인 분리 제안에) "좋아, 그렇게 확정하고 M1 시작해" | D-26 관리자 이메일+TOTP |
| 2026-10-20 | "진행간에 사용되는 쿼리, 지침 , 스킬 등은 모두 문서화 해서 나중에 다른 계정의 llm 에서도 작업을 이어갈수 있도록 해" | CLAUDE.md, AGENTS.md, docs/* 체계 |
| 2026-10-20 | "Googolf 가 회사명이자 브랜드명이야.  로고도 적절히 알아서 만들어서 넣어주도록 하고" | D-27, public/brand/ |
| 2026-10-20 | "https://www.somoim.co.kr/  을 분석해서 이런 커뮤니티 소모임을 개설 및 운영할수 있게도 하자." | M7 후보, docs/research/somoim-analysis.md |
| 2026-10-20 | "단 골프 관련 모임만으로 한정하고" | D-28 골프 모임 한정 |

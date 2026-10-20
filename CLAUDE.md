# Googolf — 작업 지침 (LLM/개발자 공통)

Googolf는 회사명이자 브랜드명이다. 전화로 받던 골프 부킹과 회원권 상담을 온라인으로 옮기는 서비스다.
이 파일은 어떤 LLM 세션이든 이어서 작업할 수 있도록 하는 단일 진입점이다. 작업 전에 아래 순서로 읽는다.

1. `docs/PROGRESS.md` — 지금 어디까지 했고 다음에 무엇을 하는지(가장 먼저)
2. `docs/BRIEF.md` — 오너의 원 지시문(마일스톤 정의, 절대 규칙, 보고 형식) 원문
3. `docs/PRD.md` — 제품 요구사항
4. `docs/DECISIONS.md` — 확정된 결정과 기본값. PRD와 충돌하면 이 문서가 우선한다
5. `docs/state-machine.md` — 상태 전이 표. DB 함수와 1:1로 맞춘다
6. `docs/RUNBOOK.md` — 환경 구성, 명령어, 자주 쓰는 SQL

## 작업 방식

- 마일스톤(M1~M6) 순서로 진행한다. **각 마일스톤이 끝나면 멈추고 보고한 뒤 오너 승인을 받는다.**
- 보고 형식(BRIEF.md 원문): ① 기능 ID와 변경 파일 요약 ② 테스트 명령어와 통과 수 ③ 셀프 리뷰(보안, 정합성, N+1, 에러 처리, 감사 로그 누락) — 발견한 문제는 고친 뒤 보고 ④ 남은 리스크와 다음 결정 사항
- 작업 단위를 끝낼 때마다 `docs/PROGRESS.md`를 갱신한다. 새로 정한 것은 `docs/DECISIONS.md`에 D-번호로 추가한다.
- 오너가 범위를 넓히면(예: 커뮤니티) 진행 중인 마일스톤에 섞지 않고 별도 마일스톤 후보로 PROGRESS/DECISIONS에 기록한다.
- 응답과 문서는 한국어. 코드 식별자와 커밋 메시지 접두어(feat/fix/docs/test/chore)는 영어.
- 무료 환경에서 진행한다(D-25). 유료 서비스가 필요한 기능은 어댑터 뒤에 두고 개발용 대체 구현을 쓴다.

## 절대 규칙 (모든 마일스톤 공통, 위반 시 머지 불가)

1. 상태 전이는 Postgres 함수로만. `security definer` + `set search_path = ''`(모든 객체를 스키마로 한정). 상태 머신에 없는 전이는 예외. 클라이언트의 status 직접 update는 권한·RLS로 막는다.
2. 모든 테이블 RLS on, 기본 거부. 고객은 `user_id = auth.uid()` 행만. 운영자 판별은 `auth.jwt()->'app_metadata'->>'role'`만(헬퍼 `app.is_admin()`), `user_metadata` 금지. 운영자는 aal2(MFA)여야 운영자로 인정한다.
3. 상태 변경 함수는 같은 트랜잭션에서 `audit_logs`와 `notification_outbox`에 기록한다. `audit_logs`는 append-only(권한 회수 + 트리거).
4. 데이터 변경 경로: Server Action → zod 검증 → `supabase.rpc(함수)`. 생성·수락은 멱등키(`p_idempotency_key`). **신뢰 경계는 DB 함수**다(브라우저가 rpc를 직접 불러도 안전해야 한다).
5. 금액 `bigint`(원), 시각 `timestamptz`, 표시는 KST.
6. 주민번호·인감·신분증 수집 금지. 서류는 private bucket + 5분 signed URL, 열람 이력은 감사 로그.
7. 어드민 경로는 middleware와 서버 컴포넌트 양쪽에서 role(+aal2) 검사.
8. 비밀값 하드코딩 금지. 새 환경변수는 `.env.example`에 문서화.
9. 모바일 우선 UI. 로딩·빈 상태·에러 상태 필수. 목록의 휴대폰 번호는 마스킹.
10. 테스트가 통과하지 않으면 완료가 아니다. 테스트 삭제·skip으로 통과시키지 않는다.

## DB 코드 규약

- 마이그레이션: `supabase/migrations/YYYYMMDDHHMMSS_<설명>.sql`. 이미 원격에 적용된 파일은 수정하지 않고 새 파일을 추가한다(현재는 원격 미적용 — PROGRESS.md 참고).
- 스키마: API 노출은 `public`, 내부 헬퍼는 `app`(PostgREST 비노출), 테스트 헬퍼는 `tests`(로컬 전용).
- 상태 함수 템플릿(`20261020000004_booking_functions.sql` 참고):
  권한(`app.require_customer/require_admin`) → 대상 행 `FOR UPDATE`(`app.lock_booking/lock_deal`) → version 검증 → 현재 상태 검증 → 변경(version+1) → 고객 타임라인(`*_events`) → `app.write_audit` → `app.enqueue_notification`
- 잠금 순서: `booking_requests → booking_proposals`, `membership_deals → membership_listings`. 반대로 잠그지 않는다.
- 에러는 `raise exception '<기계 코드>' using errcode = 'GBxxx'`. 코드표는 `20261020000003_helpers.sql` 상단과 RUNBOOK.md.
- 새 테이블: RLS enable, SELECT 정책만, DML grant 없음. 새 RPC: `grant execute ... to authenticated`를 명시(기본은 회수됨).
- RLS 정책 안에서는 `(select auth.uid())`, `(select app.is_admin())`처럼 감싸 쿼리당 1회만 평가되게 한다.
- 알림 dedupe_key는 전이마다 결정적으로 만든다(예: `booking:<id>:confirmed`).

## 테스트 규약

- pgTAP: `supabase/tests/NNN_<주제>.test.sql`. `000_setup.test.sql`이 `tests` 스키마 헬퍼를 커밋한다(가장 먼저 실행). 나머지는 `begin; ... rollback;`.
- 헬퍼: `tests.create_user(email, role, onboarded)`, `tests.authenticate_as(uid, aal)`, `tests.authenticate_anon()`, `tests.clear_authentication()`, `tests.new_booking()`.
- psql 변수 비교 시 타입을 명시한다(`:'x'::uuid`). plan 수를 정확히 맞춘다.
- 동시성: `scripts/concurrency/run.ts`(두 커넥션 경쟁, 50회 반복).

## 명령어

```bash
dockerd > /tmp/dockerd.log 2>&1 &   # 클라우드 컨테이너에서 Docker 데몬이 꺼져 있을 때
pnpm install
pnpm db:start                         # supabase start
pnpm db:reset                         # 마이그레이션 + seed 재적용
pnpm db:test                          # pgTAP
pnpm test:concurrency                 # 동시성 스크립트
pnpm db:types                         # types/database.ts 재생성(스키마 바꾸면 반드시)
pnpm typecheck
```

## 디렉터리

- `app/(customer)`, `app/(admin)/admin`, `app/api` — M2부터
- `lib/domain/{booking,membership}` — 도메인 로직(UI와 분리), `lib/supabase/{server,client,admin}.ts`
- `supabase/{migrations,tests,functions}`, `types/database.ts`(생성물, 직접 수정 금지)
- `public/brand/` — 로고(`googolf-logo.svg` 워드마크, `googolf-mark.svg` 심볼)
- `docs/` — 위 문서들, `docs/research/` 조사 자료

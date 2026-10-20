# 결정 로그

상태 구분
- **확정**: 오너가 명시적으로 승인
- **기본값**: M0에서 제안했고 오너 이의 없이 M1 착수 승인 → 적용 중. 언제든 바꿀 수 있으며, 바꾸면 영향 범위를 함께 적는다
- **보류**: 외부 사정(법률, 계약)으로 나중에 결정

PRD와 충돌하면 이 문서가 우선한다. 새 결정은 번호를 이어서 추가한다.

| ID | 주제 | 결정 | 상태 | 반영 위치 |
|---|---|---|---|---|
| D-01 | 상태 머신·데이터 모델 | PRD에 해당 섹션이 없어 M0에서 정의(state-machine.md) | 기본값 | migrations 0001~0005 |
| D-02 | 제안 유효시간 | 기본 120분, 30~1440분, 티타임을 넘지 않음 | 기본값 | `propose_booking` |
| D-03 | 확정 후 취소 | 고객은 확정 전까지만 직접 취소. 확정 후는 운영자가 사유와 함께 취소, 위약금은 오프라인 | 기본값 | `cancel_booking` |
| D-04 | SLA | 평일 09:00~18:00 KST, 접수 후 영업시간 30분. 공휴일은 `business_holidays` 수기 관리 | 기본값 | `app.business_sla_due` |
| D-05 | "1차 응답" 정의 | 담당자 배정 시각(고객에게 "확인 중" 알림 발송) 또는 거절 시각 | 기본값 | `first_responded_at` |
| D-06 | 운영자 MFA | TOTP. middleware·서버 컴포넌트·**DB 함수**에서 모두 aal2 요구 | 기본값 | `app.is_admin()` |
| D-07 | 역할 회수 지연 | JWT 만료 15분(`jwt_expiry=900`), 강등 시 세션 강제 종료(M2) | 기본값 | config.toml, M2 |
| D-08 | 신뢰 경계 | DB 함수가 모든 검증을 수행. Server Action은 zod·UX·IP 전달 | 기본값 | 전체 |
| D-09 | 감사 로그 IP/UA | Server Action이 `x-client-ip`/`x-client-ua` 헤더로 전달, 없으면 x-forwarded-for. 위조 가능한 참고값 | 기본값 | `app.write_audit` |
| D-10 | 멱등키 | 폼 렌더 시 서버가 UUID 발급 → rpc 인자. DB에서 같은 트랜잭션 처리, 24시간 보관 | 기본값 | `app.idempotency_*` |
| D-11 | rate limit | 부킹·상담 각각 사용자별 10분당 5건. advisory lock으로 직렬화. 멱등 재호출은 제외 | 기본값 | `app.enforce_rate_limit` |
| D-12 | 시간대 | 1부 06:00~10:00, 2부 11:00~15:00, 범위 지정(30분 단위는 UI에서) | 기본값 | `time_pref` |
| D-13 | 인원·예산 | 1~4명(1팀), 예산은 1인 그린피 상한(원), 선택 | 기본값 | `booking_requests` |
| D-14 | 골프장 선택 | 마스터 선택 또는 자유 입력(둘 중 하나) | 기본값 | `booking_course_xor` |
| D-15 | 배정·제안 권한 | 배정은 모든 운영자, 제안·거래 진행·조건 수정은 담당자 또는 owner. 거절·취소는 모든 운영자 | 기본값 | 상태 함수 |
| D-16 | 매물 공개 범위 | hidden 외 공개(비로그인 포함), 상담은 로그인. 등록자 id는 비공개. 법률 자문 후 RLS 정책만 변경 | 보류(법률) | `membership_listings_select` |
| D-17 | 한 매물 다중 상담 | inquiry는 여러 건, 진행(negotiating~transferring)은 1건. 판매완료 후 남은 inquiry는 운영자가 수동 취소 | 기본값 | partial unique index |
| D-18 | 매도 상담 | 매물 없이 상품 기준으로 진행. 매물 등록은 운영자가 별도로 | 기본값 | `deal_side='sell'` |
| D-19 | 통화 메모 | append-only, 정정은 새 메모 | 기본값 | `activity_notes` |
| D-20 | E2E 로그인 | `E2E_TEST_LOGIN=1` + local에서만 열리는 테스트 로그인. production 차단은 테스트로 보장 | 기본값 | M2 |
| D-21 | 전화번호 저장 | 평문 + RLS + 목록 마스킹. 암호화는 보관기간 확정 후 검토 | 보류(개인정보) | `profiles.phone` |
| D-22 | Next 버전 | Next 15 고정(`middleware.ts`) | 확정(지시문) | M2 |
| D-23 | 브랜치·PR | 지정 브랜치 `claude/affectionate-maxwell-vs76ph` 하나에 M1~M6을 누적, PR NextChans/golf#1 | 기본값 | git |
| D-24 | CI | GitHub Actions `db.yml`: reset, pgTAP, 동시성, 타입 최신 여부, typecheck. M2부터 lint·Vitest·Playwright 추가 | 기본값 | `.github/workflows` |
| D-25 | 무료 단계 운영 | 카카오 로그인 유지(무료). 휴대폰 OTP는 Supabase `test_otp`, 알림은 console 어댑터 + Slack/Discord 웹훅. 유료 항목은 출시 전 전환 체크리스트(PROGRESS.md) | 확정 | 전체 |
| D-26 | 관리자 로그인 | 고객=카카오, 관리자(admin/owner)=이메일+비밀번호+TOTP 필수, `/admin/login` 별도. 공개 가입 없음, owner가 계정 발급(임시 비밀번호→최초 로그인 시 변경+MFA 등록). 카카오 계정에는 관리자 역할 부여 금지 | 확정 | M2 |
| D-27 | 브랜드 | 회사명·브랜드명 Googolf. 색 green `#1B6B45`, lime `#C6E26B`. 로고는 임시 SVG(`public/brand`), 정식 오픈 전 아웃라인 버전으로 교체 | 확정(이름) / 기본값(로고) | `public/brand/` |
| D-28 | 커뮤니티(소모임) | 소모임형 커뮤니티를 **골프 관련 모임으로 한정**해 추가. MVP(M1~M6)와 분리해 M7 후보로 기획 | 확정(방향) / 범위 미정 | docs/research/somoim-analysis.md |
| D-29 | 서버 역할의 DML | `service_role`도 테이블 DML 권한 없음. 서버 admin 클라이언트는 Auth 관리용이고 데이터 변경은 함수로만 | 기본값 | `0006_rls_grants_cron.sql` |
| D-30 | 대안 날짜 제안 | 운영자는 요청 날짜와 다른 날짜의 티타임을 제안할 수 있다(PRD "대안 수락") | 기본값 | `propose_booking` |
| D-31 | bigint 금액의 TS 타입 | 생성 타입은 `number`. 원 단위 최대값(약 9×10^15)은 안전 정수 범위 안이라 허용 | 기본값 | `types/database.ts` |
| D-32 | 원격 DB 반영 경로 | GitHub Actions `db-deploy.yml`(workflow_dispatch, 기본 dry-run). 시크릿은 GitHub Environments(dev/prod)에 두고 prod는 승인자 필수. 로컬·클라우드 세션에서 직접 `db push` 하지 않는다 | 기본값 | `.github/workflows/db-deploy.yml` |
| D-33 | 원격 프로젝트 매핑 | `sacsqmsfwujuuudwjhbp` = **prod(운영)**. 개발은 로컬 Supabase(Docker)로 하고, dev 클라우드 프로젝트는 필요해지면 무료 2번째 슬롯으로 만든다. prod에는 seed·test_otp·테스트 계정을 절대 넣지 않는다 | 확정 | PROGRESS.md, db-deploy(prod environment) |

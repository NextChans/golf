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
| D-20 | E2E 로그인 | ~~테스트 전용 로그인~~ → D-41로 대체(백도어 없음) | 폐기 | — |
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
| D-34 | Sentry | 후순위로 보류(오너 지시). 의존성도 넣지 않는다. 재개 시 PII 마스킹 beforeSend 필수 | 확정(보류) | — |
| D-35 | 웹 분석 | Vercel Web Analytics(쿠키 없음). `/admin` 경로 제외, 쿼리스트링 제거 후 전송. 대시보드에서 Analytics 활성화 필요 | 확정 | `components/analytics/vercel-analytics.tsx` |
| D-36 | 리전 | Supabase prod는 서울(ap-northeast-2). Vercel 함수 리전도 서울 `icn1`(vercel.json) | 확정 | `vercel.json` |
| D-37 | 배포 URL | Vercel production: https://golf-lac-delta.vercel.app (도메인 연결 전 임시). prod `NEXT_PUBLIC_SITE_URL`, Supabase Auth Site URL·Redirect URL에 사용 | 확정 | PROGRESS.md 배포 체크리스트 |
| D-38 | 공개 가입 차단 | 이메일 제공자는 관리자 로그인용으로 켜 두고, `before_user_created` 훅이 카카오 외 자가 가입을 403으로 거부(Admin API 생성에는 훅 미적용, 실험으로 확인) | 기본값 | `public.before_user_created_hook` |
| D-39 | 휴대폰 인증 확인 | Auth `sms.enable_confirmations=true` 필수. false면 OTP 없이 번호가 인증 처리됨(M2 실험으로 확인) | 확정(보안) | config.toml, prod 대시보드 |
| D-40 | 최초 owner | `pnpm seed:owner`(service_role) → `bootstrap_owner`는 owner가 0명일 때만 동작 | 기본값 | `scripts/seed-owner.ts` |
| D-41 | E2E 로그인 | 앱에 테스트용 백도어를 두지 않는다. E2E는 Admin API로 만든 이메일 계정 + 실제 로그인 화면 + otplib TOTP로 진행. 카카오 경로는 pgTAP·단위 테스트로 검증 | 기본값(D-20 대체) | `e2e/` |
| D-42 | 고객 휴대폰 인증 | 운영 환경에서는 일단 생략(오너 지시). `app_settings.phone_verification_required=false`(기본). SMS 대행사 계약 후 owner가 `set_app_setting`으로 켠다. 꺼져 있으면 온보딩은 이름·약관만, 번호는 null | 확정 | `20261020000008_app_settings.sql` |
| D-43 | 디자인 | apple.com 웹 스타일(오너 지시, iOS 앱 스타일 아님). 흰/연회색 섹션, 큰 헤드라인, 알약 CTA, 큰 타일, 플로팅 라벨 입력. 강조색은 브랜드 그린. 가이드·테스트 계약은 docs/DESIGN.md | 확정 | `app/globals.css`, `components/site/*` |
| D-44 | 운영 DB 최초 반영 | 클라우드 세션에서 DB 직접 접속이 안 되므로 `deploy/2026-10-20-01-initial-schema.sql`(마이그레이션 묶음 + 적용 이력 기록)을 오너가 SQL Editor에서 실행. 이후 변경은 db-deploy 또는 `bundle-migrations.mjs --from` | 기본값 | `deploy/README.md` |
| D-45 | OAuth 콜백 origin | 로그인을 시작한 호스트로 돌아온다(preview 배포의 PKCE 쿠키 대응). 허용 목록: 운영 URL·VERCEL_URL·VERCEL_BRANCH_URL·로컬, 그 외는 운영 URL. Supabase Redirect URLs에 preview 와일드카드 등록 필요 | 기본값 | `lib/auth/origin.ts` |
| D-46 | 카카오 동의항목 | Supabase 카카오 연동이 닉네임·프로필 사진·이메일 scope를 기본 요청 → 카카오 앱에 셋 다 설정(사진·이메일은 선택 동의). 개인정보처리방침에 수집 항목 명시 필요(D-21) | 확정 | 카카오 콘솔 |
| D-47 | 앱 아이콘 | `public/brand/icons/`: 정사각형(1024·512·192·180·128·32, 플랫폼이 모서리 처리)과 둥근 모서리(1024·512). `/apple-touch-icon.png`=180 | 확정 | `app/layout.tsx` |
| D-48 | 고객 연락처 | 휴대폰 인증 생략 중(D-42)에도 연락처는 필수로 직접 입력(형식 검증만, `phone_verified_at=null`). 내 정보에서 변경(감사 로그). 연락처 없는 고객의 부킹·상담 생성은 DB 트리거가 차단. 인증 필수 모드로 바뀌면 직접 변경 불가 | 확정 | `20261020000009_contact_phone.sql` |

| D-49 | 모르는 에러 코드 대체 | 프론트가 모르는 기계 코드(DB가 먼저 배포된 경우)는 SQLSTATE 계열로 대체 메시지(GB422→입력값 확인, GB409→상태 확인 등). "일시적인 오류"는 재시도로 풀릴 수 있는 경우에만. 계기: 009 트리거가 PR #5 UI보다 먼저 운영 반영되어 연락처 없는 고객에게 "일시적인 오류" 노출 | 확정 | `lib/domain/errors.ts` |
| D-50 | 운영 반영 순서 | 추가만 하는 DB 변경(함수·컬럼·인덱스)은 DB 먼저 → 앱 배포. 기존 동작을 막는 변경(트리거·제약 강화)은 그 에러 코드를 처리하는 앱을 먼저 배포 → DB. PR 설명에 구분을 적는다(009 사고 재발 방지) | 확정 | `deploy/README.md` 1-1 |
| D-51 | 운영자 인박스 | 탭: 신규(requested)·내 담당·SLA 초과(requested이고 응답 기한 경과 — cron 표시 전에도 보이게 sla_due_at으로 판정)·진행 중·전체. 대기열은 오래된 순, 최대 100건. 목록 전화번호 마스킹, 상세는 전체 번호(전화 확인용) | 기본값 | `app/(admin)/admin/(console)/bookings` |
| D-52 | 제안 입력 | 티타임은 datetime-local을 KST로 해석해 `+09:00` ISO로 전송(브라우저 시간대 무관). 그린피 기본값은 골프장 주중/주말 단가(라운딩 날짜의 KST 요일). 제안은 담당자·owner만(DB와 동일), 다른 담당 건은 안내만 표시 | 기본값 | `lib/domain/booking/admin.ts` |
| D-53 | 매물 등록·수정 | 새 매물은 hidden으로 만들고 공개는 `set_listing_visibility`로만. 상담 중(reserved)에는 호가·상품 변경 금지(설명만), 판매완료는 수정 불가 | 기본값 | `upsert_listing` |
| D-54 | 시세 | 상품·일자당 1건, 같은 날은 덮어쓰기(감사 로그에 이전 값). 미래 날짜 금지. 차트(F-08)는 P1 | 기본값 | `upsert_quote` |
| D-55 | 거래 배정 | 모든 운영자가 배정 가능(D-15), 상태 변경 없음(version+1, 감사 로그, 알림 없음). 협의 시작 시 담당자가 없으면 시작한 운영자 | 기본값 | `assign_deal`, `start_deal` |
| D-56 | 마스터 데이터 알림 | 상품·매물·시세 저장은 알림(outbox)을 만들지 않는다(고객 상태 변경이 아님, 감사 로그만). 매물 상태 전이 알림은 거래 함수가 담당 | 확정(오너 2026-10-20) | `upsert_*` |
| D-57 | 운영 목록 상한 | 인박스·매물·상품 최대 100~200건, 시세 30건, 페이지네이션 없음. 물량이 늘면 커서 페이지네이션 추가 | 확정(오너, 후속) | 운영자 화면 |
| D-58 | 매물별 상담 목록 | 매물 상세의 상담 목록에 고객 이름 + 마스킹 번호 표시(규칙 9) | 확정(오너) | `memberships/listings/[id]` |

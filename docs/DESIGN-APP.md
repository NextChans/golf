# Googolf 회원권 앱 디자인 시스템 (D-80)

오너 지시(2026-10-24): "그린판다 앱을 리서치해 디자인 시스템을 만들고 각 화면 기능을 같게 만들어라. 데이터는 목업."
적용 범위는 회원권 앱 화면이다: 앱 홈인 루트(`/`, D-87)와 `/market` 아래 화면. 기존 웹 화면(회원권 매물·모임·내 정보·운영자)은 지금처럼 `docs/DESIGN.md`(apple.com 스타일)를 따른다. 부킹 화면은 D-87로 제거했다.

## 1. 벤치마크 요약 — 그린판다

- 성격: 모바일 앱(iOS) 골프 회원권 거래 플랫폼. 앱스토어 설명은 "딜러를 만나지 않고 스마트폰으로 거래", "실거래가·입찰가를 전화 없이 확인", "내 회원권이 지금 얼마에 팔릴지 조회", "원하는 가격을 제안하거나 선택해서 거래"
- 신뢰 장치(보도 기준): 카카오 본인인증·전자서명 계약, 은행 가상계좌 안전결제, 명의개서까지 단계 확인, 수수료 정찰제(거래 전 최종 부담액 공개), 거래 사고 보장(대금 사고·명의개서 불가·판매자 변심·이중계약·미고지 권리 하자)
- 시세: 주간 단위 수집, 권역별 평균, 최근 12주 추이, 전주 대비 변화율, 예산 구간(1억 미만~9억 이상)별 비교
- 정보 구조(캡처 8장 기준): 하단 탭 4개 — 회원권 거래 / 회원권 검색 / 나의 회원권 / 마이페이지

| 그린판다 화면 | Googolf 화면 | 비고 |
|---|---|---|
| 첫 실행 추적 허용 안내(ATT) | `/market/welcome` 관심 지역·예산 고르기 | 웹은 제3자 추적을 하지 않으므로 ATT 대신 취향을 직접 받는다 |
| 홈 · 회원권 구매 탭 | `/`(D-87, `/market`은 `/`로 redirect) | 고정 헤더, 거래 체결 티커, 검색 진입, 기획전 배너, 이번주 시세 카드, 즉시 구매/인기/상승/하락 카드 목록(5건+더보기), 최근 확인한 회원권, 지역별 타일, 프로모 캐러셀, 친구 초대, 회사 정보 푸터(D-83) |
| 홈 · 회원권 판매 탭 | `/?tab=sell` | "지금 팔면 얼마일까?" 골프장 검색 → 즉시 판매가·예상 수수료·예상 수령액 |
| 공지 모달 + 쿠폰 바텀시트 | 홈 팝업 | "오늘 그만 보기"(KST 날짜), "다시 보지 않기"(영구), "닫기"(세션) |
| 맞춤 회원권 검색 | `/market/search` → `/market/search/results` | 지역(복수)·가격대(복수)·검색어, 하단 초기화 + 전체보기/N건 보기 |
| 나의 회원권 | `/market/my` | 비로그인: 로그인 유도 카드. 로그인: 보유 회원권 현재 가치·취득가 대비 |
| 로그인(이메일·소셜 4종) | `/market/login` | **카카오만**(D-81). 다른 수단은 추후 |
| 신규 회원가입 · 회원 유형 | `/market/signup` | 개인회원 / 기업회원 카드 |
| 개인 회원가입(소셜 4종 + 이메일) | `/market/signup/personal` | 3단계 표시, 1단계 카카오만 → 2단계 기존 `/onboarding` |
| (가입 2·3단계) | `/onboarding` | 2단계 정보 입력(이름 카카오 닉네임 미리 채움·연락처·약관, 하단 고정 "가입 완료") → 3단계 환영 화면(같은 페이지 상태, 혜택 카드·"회원권 둘러보기"), D-82 |
| 기업 회원가입(사업자명·사업자등록번호) | `/market/signup/business` | 검증번호 확인 후 "다음" → 담당자 카카오 연결. "사업자 인증이 안되시나요?" → 고객센터 |
| 마이페이지 | `/market/mypage` | 관심 회원권·쿠폰함·판매 희망가 / 개인정보·판매 관리·구매 관리·설정 / 고객센터 |
| 회원권 상세(캡처 12장, D-85) | `/market/items/[id]` | 사진 영역·요약·종류 선택·가격 카드·고정 탭 4개(시세/회원권 정보/이용 정보/골프장 정보)·차트·표·계산기·FAQ·떠 있는 버튼·하단 CTA(구매하기 → `/memberships`, 판매하기 → `/market/mypage/asks/new?item=`). 한 페이지 스크롤 |
| (캡처 없음, 추정) | `/market/report` 이번주 시세, `/market/notifications`, `/market/notices/fee`, `/market/guide/guarantee` | 그린판다 실제 화면 캡처를 받으면 맞춘다 |

### 따라 하지 않는 것(법·신뢰)
- 그린판다의 로고·일러스트·사진·문구·수수료 수치를 그대로 쓰지 않는다. 구조와 상호작용만 참고하고 브랜드·문구·그림은 Googolf 것으로 만든다(부정경쟁방지법상 트레이드 드레스 위험).
- 목업 골프장명은 모두 가상이다. 실제 골프장 이름에 지어낸 시세를 붙이지 않는다.
- "업계 유일" 같은 최상급 표현, 확정되지 않은 보장 문구는 쓰지 않는다(표시광고법). 보장·수수료는 약관 확정 전까지 "미리보기/초안"으로 표시.
- 추적 허용을 손가락 그림으로 유도하는 화면은 만들지 않는다.

## 2. 원칙
1. **한 화면 한 질문** — 화면마다 큰 헤드라인 하나("내 회원권, 지금 팔면 얼마일까?"), 나머지는 회색 보조.
2. **숫자가 주인공** — 가격은 굵게, `tabular-nums`, "3억 3,874만원" 표기(만원 미만 버림). 상승 빨강·하락 파랑(국내 관례).
3. **캔버스 + 시트** — 상단은 연회색 캔버스, 내용은 위 모서리 24px 라운드 흰 시트.
4. **탭 4개 고정** — 하단 탭 바, 활성은 브랜드 그린. 하위 화면은 탭 바 대신 뒤로가기 + 하단 고정 CTA.
5. **누름 피드백** — 모든 탭 대상은 `.pressable`(scale 0.97). 최소 44px.
6. **모바일 폭 고정** — 최대 480px 중앙. 데스크톱에서도 앱 폭으로 보인다.

## 3. 토큰(app/globals.css)

| 용도 | 클래스 | 라이트 | 다크 |
|---|---|---|---|
| 캔버스(상단·바깥) | `bg-canvas` | #f2f4f7 | #101114 |
| 시트·카드 | `bg-surface` | #ffffff | #1b1d21 |
| 연한 칸·구분 띠 | `bg-fill` | #f4f6f8 | #24272c |
| 테두리 | `border-line` | #e5e8eb | #33363c |
| 헤드라인 / 본문 / 보조 / placeholder | `text-ink` / `text-ink-sub` / `text-ink-mute` / `text-ink-faint` | #191f28 / #4e5968 / #8b95a1 / #b0b8c1 | |
| 브랜드(버튼·활성 탭) | `bg-brand`, `text-brand`, `hover:bg-brand-hover` | #46735a | #5f9a78 |
| 본문 속 강조 | `text-brand-ink`, 바탕 `bg-brand-soft` | #3a6b4f / #eaf2ec | |
| 안내 링크 | `text-info`, `bg-info-soft` | #3182f6 | |
| 상승 / 하락 | `text-up` / `text-down` | #f04452 / #3182f6 | |
| 딤 | `bg-scrim` | 검정 55% | 70% |

라운드: 시트·팝업 `rounded-t-sheet`/`rounded-sheet`(24), 카드·배너 `rounded-card`(16), 버튼·칩·입력 `rounded-control`(12).

타이포(굵기로 위계, 크기는 6단계):

| 토큰 | 크기 | 쓰임 |
|---|---|---|
| `text-display` | 28 | 화면 헤드라인, 큰 금액 |
| `text-heading` | 22 | 섹션 제목, 카드 금액, 로그인 유도 |
| `text-subhead` | 18 | 상단 바 제목, 메뉴, 버튼, 상단 탭 |
| `text-label` | 16 | 본문, 칩, 목록 |
| `text-caption` | 14 | 보조 설명 |
| `text-tiny` | 11 | 탭 바 라벨, 배지, 고지 |

새 글자 크기 토큰은 `lib/utils.ts` tailwind-merge 설정에도 넣는다(이미 반영).

## 4. 컴포넌트(components/market)

| 컴포넌트 | 파일 | 설명 |
|---|---|---|
| `AppScreen` | ui.tsx | 480px 앱 틀, `tone="canvas"`, 탭 바 여백 |
| `TopBar` | ui.tsx | 가운데 제목 56px, `back` 경로, `right` 슬롯 |
| `TabBar` | tab-bar.tsx | 하단 탭 4개(`navigation` 이름 "앱 메뉴", 활성 `aria-current="page"`) |
| `MenuGroup`·`MenuRow`·`Divider` | ui.tsx | 마이페이지형 68px 메뉴 행 + 10px 구분 띠 |
| `LoginPrompt` | ui.tsx | 회색 아바타 + "로그인 · 회원가입 ›" + 강조 단어 그린, `boxed` 카드형 |
| `Stepper` | ui.tsx | 가입 3단계(원 + 선, `aria-current="step"`) |
| `BusinessSignup` | business-signup.tsx | 사업자 정보 → 카카오 연결 2화면 |
| `StateView` | ui.tsx | 빈 상태·에러(에러는 `role="alert"`) |
| `primaryButtonClass`·`secondaryButtonClass`·`chipClass` | ui.tsx | 56px 버튼, 칩은 `aria-pressed`로 선택 표시 |
| `ItemRow` | item-row.tsx | 골프장명·확인 배지·지역·유형·홀, 가격·변화율(검색 결과·관심 목록) |
| `ItemCardList`·`ItemCard` | item-card.tsx | 홈 목록 회색 카드(첫 글자 아바타·이름·유형·가격·구매가능/변화율), 5건씩 "더보기" |
| `RecentList`·`RecordView` | recent.tsx | 최근 확인한 회원권 가로 카드(localStorage 10개), 상세 진입 시 기록. 기록 없으면 숨김 |
| `PromoCarousel` | promo-carousel.tsx | 하늘색 풀폭 배너 4장 스와이프, 우상단 "n/4" |
| `InviteCard` | invite-card.tsx | 친구 초대(어두운 카드), 공유 시트 또는 홈(`/`) 주소 복사 |
| `CompanyFooter` | company-footer.tsx | 회사 정보·중개 고지문(값은 `lib/company.ts`) |
| `REGION_TONE` | region-tone.ts | 지역 그라디언트(검색 타일·홈 타일·최근 카드 공용) |
| `Sparkline` | sparkline.tsx | 12주 꺾은선 SVG(면 그라디언트, 마지막 점) |
| `DealTicker` | deal-ticker.tsx | "거래 체결" 3초 롤링(동작 줄이기면 정지) |
| `HomePopups` | home-popups.tsx | 공지 모달(위) + 혜택 바텀시트(아래), Esc·딤 클릭으로 닫기 |
| `SellEstimator` | sell-estimator.tsx | combobox 검색 → 예상 판매가 카드 |
| `SearchFilter` | search-filter.tsx | 지역 원형 타일·가격대 칩·하단 고정 버튼 |
| `FavoriteButton`·`useFavorites` | favorites.tsx | 관심 하트(목업: localStorage) |
| `components/market/detail/*` | detail/ | 상세 전용(D-85). `DetailTopBar`(사진 위 → 흰 바 고정, 공유), `DetailHero`, `DetailSummary`·`KindSelect`, `PriceCard`·`PriceInfo`, `DetailTabs`(sticky, IntersectionObserver)·`ScrollLink`, `PriceTrend`·`TrendChart`(선 그래프), `DealTables`, `Features`, `Admission`(개인/법인), `UsageInfo`, `CourseInfo`·`CopyAddress`, `CostCalculator`, `ReportBanner`, `DetailFaq`, `FloatingActions`, `BottomCta` |
| `shareOrCopy`·`copyText` | share.ts | `navigator.share` → 없으면 클립보드. 결과 `shared/copied/failed/aborted` |
| `storage.ts` | | localStorage 래퍼(모든 접근 try/catch) |

## 4-1. 폰트(D-86)

- 앱 영역(앱 홈 `/`, `/market/**`, `/onboarding`)만 **Pretendard Variable**을 서버에서 직접 내려준다(외부 CDN 없음). 기존 apple 스타일 화면은 `--font-sans` 그대로(D-86·D-87).
- 출처: npm `pretendard@1.3.9`(https://github.com/orioncactus/pretendard, Kil Hyung-jin). 라이선스 SIL Open Font License 1.1(상업 사용·셀프 호스팅 가능, 폰트와 함께 라이선스 문구 배포 필수) — 문구는 `public/fonts/pretendard/LICENSE.txt`, 각 @font-face 앞 CSS 머리말에도 있다.
- 파일: `public/fonts/pretendard/PretendardVariable.subset.{0..91}.woff2`(한글을 92조각으로 나눈 dynamic subset, 합계 약 3.1MB) + `LICENSE.txt`. 선언은 `app/market/pretendard.css`(`font-family: "Pretendard Variable"`, `font-display: swap`, `unicode-range`). 브라우저는 화면에 쓰인 글자가 속한 조각만 받는다(앱 홈 `/` 첫 로드 약 13개).
- 로드: `components/market/font-preload.tsx`(`AppFontPreload`)가 CSS를 import하고 라틴·숫자 조각(subset 91)만 preload한다. `MarketShell`(`app/market/layout.tsx`·루트 `app/page.tsx`)과 `/onboarding` 페이지에서만 렌더하므로 다른 경로에는 새지 않는다. swap이라 첫 글자는 시스템 폰트로 보였다가 바뀐다(FOUT, 글자 가림 없음).
- 적용: `font-app` 유틸리티(`--font-app`)를 `AppScreen` 루트·`TabBar`·미리보기 띠·환영 화면 루트에 둔다(fixed 요소는 모두 `AppScreen` 안이라 상속). `AppScreen`은 `tabular-nums`도 켜서 가격·시세 자릿수가 흔들리지 않게 한다. 새 앱 화면이 `AppScreen` 밖이면 루트에 `font-app`을 준다.
- 굵기: 헤드라인(`text-display`/`text-heading`)·큰 금액은 `font-bold`(700), 라벨·버튼·부제는 `font-semibold`(600) 이하. `font-extrabold`(800)는 앱 영역에서 쓰지 않는다.
- 갱신: 새 버전은 `npm pack pretendard@<버전>`으로 받아 새 폴더에 풀고(스크립트 실행 금지), `dist/web/variable/woff2-dynamic-subset/*.woff2`를 같은 폴더에 교체, `pretendardvariable-dynamic-subset.css`의 `url(./woff2-dynamic-subset/`를 `url(/fonts/pretendard/`로 바꿔 `app/market/pretendard.css`에 덮어쓴다. 조각 번호(라틴 조각 91)가 바뀌면 `font-preload.tsx`도 고친다. `e2e/font.spec.ts`로 확인.

## 5. 데이터와 규칙
- 목업: `lib/mock/market.ts`(가상 골프장 16곳·항목 18개(같은 골프장 두 유형 2곳), 12주 시세, 체결·쿠폰·알림·FAQ·수수료 정책). 실데이터 연결 때 같은 `MarketItem` 타입으로 바꿔 끼운다.
- 규칙(순수 함수, Vitest): `lib/domain/market/schema.ts` — 금액 표기, 변화율, 평균 시세, 가격대(하한 포함·상한 미포함), 필터(지역 OR·가격대 OR·조건 사이 AND), 탭 정렬, 수수료, KST "오늘 그만 보기".
- 저장: 관심·팝업 숨김·설정·취향은 이 브라우저에만 저장(미리보기). 실데이터 단계에서 로그인 고객 기준 DB로 옮긴다(RLS·감사 로그 규칙 적용).

## 6. E2E 계약(바꾸지 말 것, `e2e/market.spec.ts`)
- 내비: `navigation` "앱 메뉴" 안 링크 "회원권 거래"·"회원권 검색"·"나의 회원권"·"마이페이지"
- 대화상자: "거래 수수료 기준이 바뀝니다", /수수료 최대/. 버튼 "닫기"·"오늘 그만 보기"·"다시 보지 않기"
- 링크 "어떤 회원권을 찾고 계신가요?", /로그인 · 회원가입/
- 헤딩 "맞춤 회원권 검색", "나의 회원권". 버튼 "전체보기"·"N건 보기", 지역 버튼(aria-pressed)
- combobox "보유 회원권 골프장명", option 안 버튼, region "예상 판매가"
- 가입: 버튼 "카카오로 계속하기", 링크 "회원가입"·/개인회원/·/기업회원/, 목록 "가입 단계 1/3", 라벨 "사업자명"·"사업자등록번호", 버튼 "다음", 헤딩 /담당자 카카오 계정을/
- 가입 2·3단계(`e2e/onboarding.spec.ts`, `e2e/contact.spec.ts`): 목록 "가입 단계 2/3"·"가입 단계 3/3", 헤딩 /정보를 알려주세요/, 라벨 "이름"(정확히)·"연락처(휴대폰)", checkbox "전체 동의"·/\[필수\]/, 버튼 "가입 완료", 헤딩 "{이름}님, 환영합니다!", 링크 /첫 거래 수수료 20% 할인 쿠폰/, 버튼 "회원권 둘러보기"
- 로그인 유도 링크 href는 `/market/login?next=<경로>`
- 루트(D-87, `e2e/root.spec.ts`): `/`가 URL 그대로 앱 홈(제목 "Googolf — 골프 회원권 거래", 미리보기 띠, `navigation` "앱 메뉴"의 "회원권 거래" `aria-current="page"`·href `/`), `navigation` "거래 구분" 링크 "회원권 구매"(`/`)·"회원권 판매"(`/?tab=sell`), "목록 정렬" 링크 `/?list=…`, 앱 화면의 "뒤로"·로고는 `/`. `/market`·`/bookings/**`는 `/`로, `/admin/bookings/**`는 `/admin`으로 redirect(307)
- 홈 구매 탭(D-83, 판매 탭 제외): 링크 "알림"이 스크롤 후에도 뷰포트에 보임, 목록 카드 링크(/구매가능/)가 처음 5건 → "더보기" 클릭 후 10건, 헤딩 "최근 확인한 회원권"(상세 방문 후에만), 지역 링크(예: "강원")→`/market/search/results?region=gangwon`, region "Googolf 소식"(텍스트 "1/4", 링크 4개), footer에 "(준비 중)"·"중개 서비스입니다", 버튼 "초대 링크 보내기"(복사 후 "링크를 복사했어요", 주소는 홈 `/`·쿼리 없음)
- 회원권 상세(D-85, `e2e/market.spec.ts` "회원권 상세"): 직접 진입 시 팝업 없음, heading 골프장명(h1, 1개), region "가격 정보"(현재 시세·즉시 구매가·즉시 판매가·최근 거래가), navigation "상세 정보 탭" 링크 4개 `["시세","회원권 정보","이용 정보","골프장 정보"]`·활성 `aria-current="true"`, table /그린피/, 기간 group 버튼 6개월·1년·3년·전체(`aria-pressed`)와 `data-testid="trend-sentence"`("최근 6개월간" 등), 개인/법인 버튼과 `data-testid="admission-list"`, 계산기 라벨 "얼마에 구매하고 싶으신가요?"/"얼마에 판매하고 싶으신가요?"·버튼 "계산하기"·"100만원 늘리기"·region "예상 비용"("중개 수수료"·"총 예상 비용"/"예상 수령액")·`role="alert"`, 링크 "상담 문의", 버튼 "맨 위로"(300px 이상일 때만)·"주소 복사"·"공유", 링크 "구매하기"·"판매하기", combobox "회원권 종류"

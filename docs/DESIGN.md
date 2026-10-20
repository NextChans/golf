# Googolf 디자인 가이드 — apple.com 웹 스타일 (D-43)

오너 지시: "Apple 홈페이지 스타일". iOS 앱 스타일이 아니라 **apple.com 웹사이트**의 시각 언어를 따른다. 브랜드 강조색은 Googolf 그린.

## 기준 스킬

- **`.claude/skills/apple-design`** — Emil Kowalski의 apple-design 스킬(Apple WWDC 디자인 원칙의 웹 번역, MIT, 출처·커밋은 같은 폴더 LICENSE). 오너 지정 디자인 스킬이다. UI를 만들거나 리뷰할 때 이 스킬을 먼저 읽는다.
- 적용 현황: §1 누름 피드백(`.pressable` scale 0.97, 100ms ease-out), §12 반투명 소재·스크롤 경계(`.material-bar`, `.scroll-edge`), §14 reduced-motion/transparency/contrast, §15 크기별 자간·rem 단위 타이포, §16 구체적인 내비 이름.
- 아직 해당 없음: 제스처·스프링·모멘텀(§2~§10) — 드래그·시트 UI가 생기면 적용(스프링 기본 damping 1.0).

## 원칙
1. **여백과 타이포가 주인공** — 큰 헤드라인, 짧은 문장, 넉넉한 세로 여백(섹션 py-14 md:py-24). 장식·그림자·테두리는 최소화.
2. **섹션 교차** — 흰 바탕(`bg-background`)과 연회색(`bg-section` #f5f5f7)을 번갈아. 강조 섹션만 검정(`Section tone="dark"`).
3. **알약형 CTA** — 주요 동작은 `Button`(rounded-full, 브랜드 그린). 보조 동작은 `MoreLink`("더 알아보기 ›") 또는 `variant="ghost"`.
4. **큰 라운드 타일** — 정보 묶음은 `Tile`(rounded 28px, bg-section, 테두리 없음). 목록 항목은 흰 카드 + 얇은 구분선.
5. **폼은 Apple 계정 화면처럼** — `FloatingInput`(56px, 플로팅 라벨), 선택지는 `optionTileClass` 타일(선택 시 2px 그린 테두리).
6. **반투명 내비** — `GlobalNav`(48px, blur) + 페이지별 `LocalNav`(제목 + 작은 알약 CTA).
7. **모바일 우선** — 기준 폭 390px. 데스크톱은 `max-w-[1024px]` 중앙 정렬, 폼은 `max-w-[560px]`.

## 토큰(app/globals.css)
| 용도 | 클래스 |
|---|---|
| 본문 텍스트 / 보조 | `text-foreground` (#1d1d1f) / `text-muted-foreground` (#6e6e73) |
| 섹션 배경 | `bg-background`, `bg-section` |
| 강조 | `text-primary`, `bg-primary`, `hover:bg-primary-hover` |
| 테두리 | `border-border` / 입력 `border-input` (#d2d2d7) |
| 타이포 | `text-hero`(48)·`md:text-hero-lg`(80), `text-headline`(40), `text-title`(28), `text-eyebrow`(21), `text-body`(17), `text-small`(14), `text-micro`(12) |
| 라운드 | 타일 `rounded-tile-lg`(28) / `rounded-tile`(18), 입력 `rounded-xl` |

## 컴포넌트(components/site)
- `GlobalNav` — 모든 고객 화면 상단(서버 컴포넌트, 로그인 상태에 따라 링크)
- `LocalNav title action` — 페이지 이름 + 오른쪽 CTA(예: "새 요청")
- `Section tone`, `Tile`, `MoreLink` — section.tsx
- `SiteFooter` — 고객 화면 하단 고지
- `FloatingInput`, `optionTileClass` — field.tsx
- 운영자 콘솔은 같은 토큰을 쓰되 정보 밀도를 우선(작은 글씨 허용, 표·리스트 중심)

## 상태 표현
- 로딩: 회색 스켈레톤(`bg-section animate-pulse rounded-tile`)
- 빈 상태: 큰 타일 안에 한 줄 헤드라인 + 설명 + 알약 CTA
- 에러: 타일 안에 짧은 문장 + "다시 시도" 버튼, 색은 `text-destructive`를 문장에만
- 상태 배지: 작은 알약(`Badge`), 강조는 그린, 불가·취소는 회색 계열

## 테스트 계약(바꾸지 말 것)
E2E가 접근성 이름으로 요소를 찾는다. 디자인을 바꿔도 아래 이름·testid·구조는 유지한다(`e2e/*.spec.ts`).
- 버튼/링크 이름: "카카오로 시작하기", "로그인", "비밀번호 변경", "확인", "계정 발급", "운영자 관리"(링크), "부킹 요청하기", "4명"(인원 버튼, aria-pressed), "이 시간으로 확정", "다른 시간 요청", "요청 취소"
- 라벨: "이메일", "비밀번호"(정확히), "새 비밀번호", "새 비밀번호 확인", "6자리 코드", "라운딩 날짜", "1인 그린피 예산(선택)"
- 라디오: 시간대 radio의 이름에 "1부" 포함, 기본 선택은 1부
- 헤딩: "운영자 로그인", "접근 권한이 없습니다", "운영자 홈", "예약을 찾을 수 없습니다"
- 텍스트: "아직 요청한 예약이 없습니다", "부킹 요청이 접수되었습니다.", "총 720,000원" 형식, "날짜를 선택해 주세요.", "OTP 미등록", "N시간 N분 남음"
- testid: `booking-status`, `proposal-remaining`, `totp-secret`, `temp-password`
- `aria-label="확정된 티타임"` 섹션
- `/bookings/new`에서 **부킹 폼이 문서의 첫 번째 `<form>`** 이어야 한다(내비에 로그아웃 폼 등을 두지 말 것)
- 목록에서 예약 항목은 상태 라벨을 포함한 `link`

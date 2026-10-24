import type { FeePolicy, MarketItem } from "@/lib/domain/market/schema";

/**
 * 회원권 앱 목업 데이터(D-80). 골프장명은 모두 가상이며 실제 골프장·시세와 무관하다.
 * 실데이터(membership_products·membership_quotes·membership_listings) 연결 전까지 화면 개발용으로만 쓴다.
 */

const MAN = 10_000;

/** 기준가(만원)와 주별 변화(만원, 11개)로 12주 시세를 만든다 */
function series(baseMan: number, deltasMan: number[]): number[] {
  const out = [baseMan * MAN];
  for (const d of deltasMan) out.push(out[out.length - 1]! + d * MAN);
  return out;
}

export const MARKET_ITEMS: MarketItem[] = [
  { id: "m01", courseName: "솔빛힐스CC", region: "seoul_gyeonggi", kind: "개인 정회원", holes: 27, weekly: series(48_500, [-300, 0, -200, 0, 0, -100, 0, 0, 0, 0, 100]), askPrice: 48_000 * MAN, bidPrice: 46_500 * MAN, likes: 412, benefits: ["정회원 그린피 면제", "주말 월 2회 부킹", "가족 1인 우대"], verified: true },
  { id: "m02", courseName: "청람레이크CC", region: "seoul_gyeonggi", kind: "개인 정회원", holes: 18, weekly: series(5_200, [-100, 0, 0, -50, 0, 0, -50, 0, 0, 0, 0]), askPrice: 4_800 * MAN, bidPrice: 4_600 * MAN, likes: 528, benefits: ["회원 그린피 7만원", "주중 무제한 부킹"], verified: true },
  { id: "m03", courseName: "은하수밸리GC", region: "seoul_gyeonggi", kind: "법인 정회원", holes: 36, weekly: series(92_000, [0, 500, 0, 0, 1_000, 0, 0, 500, 0, 0, 1_000]), askPrice: 95_000 * MAN, bidPrice: 93_000 * MAN, likes: 233, benefits: ["기명 2인·무기명 1인", "주말 우선 부킹"], verified: true },
  { id: "m04", courseName: "푸른숲CC", region: "seoul_gyeonggi", kind: "주중 회원", holes: 18, weekly: series(3_100, [0, 0, -50, 0, 0, 0, 0, 0, 0, 50, 0]), askPrice: 3_050 * MAN, bidPrice: 2_900 * MAN, likes: 301, benefits: ["주중 그린피 5만원", "주중 월 4회 부킹"], verified: true },
  { id: "m05", courseName: "백운파인CC", region: "gangwon", kind: "개인 정회원", holes: 27, weekly: series(21_000, [-500, 0, 0, -300, 0, 0, -200, 0, 0, 0, -100]), askPrice: 19_500 * MAN, bidPrice: 18_800 * MAN, likes: 187, benefits: ["회원 그린피 면제", "숙박 20% 할인"], verified: true },
  { id: "m06", courseName: "설원마운틴GC", region: "gangwon", kind: "가족 회원", holes: 36, weekly: series(14_500, [0, 0, 200, 0, 0, 300, 0, 0, 0, 200, 0]), askPrice: null, bidPrice: 14_800 * MAN, likes: 142, benefits: ["가족 4인 등록", "콘도 객실 연 10박"], verified: true },
  { id: "m07", courseName: "호수정원CC", region: "chungcheong", kind: "개인 정회원", holes: 18, weekly: series(8_900, [0, -100, 0, 0, 0, -100, 0, 0, 0, 0, 0]), askPrice: 8_700 * MAN, bidPrice: 8_400 * MAN, likes: 264, benefits: ["회원 그린피 4만원", "주말 월 2회"], verified: true },
  { id: "m08", courseName: "금강리버CC", region: "chungcheong", kind: "주중 회원", holes: 27, weekly: series(2_600, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), askPrice: 2_550 * MAN, bidPrice: 2_400 * MAN, likes: 98, benefits: ["주중 그린피 면제"], verified: true },
  { id: "m09", courseName: "남해오션GC", region: "gyeongsang", kind: "개인 정회원", holes: 18, weekly: series(31_000, [0, 0, 0, 500, 0, 0, 0, 0, 500, 0, 300]), askPrice: 32_500 * MAN, bidPrice: 31_500 * MAN, likes: 205, benefits: ["회원 그린피 면제", "동반 2인 우대"], verified: true },
  { id: "m10", courseName: "가야산CC", region: "gyeongsang", kind: "개인 정회원", holes: 27, weekly: series(12_800, [-200, 0, 0, 0, -100, 0, 0, 0, 0, -100, -200]), askPrice: 12_000 * MAN, bidPrice: 11_600 * MAN, likes: 120, benefits: ["회원 그린피 3만원"], verified: true },
  { id: "m11", courseName: "영산강CC", region: "jeolla", kind: "개인 정회원", holes: 18, weekly: series(6_400, [0, 0, -100, 0, 0, 0, 0, -100, 0, 0, 0]), askPrice: 6_150 * MAN, bidPrice: 5_900 * MAN, likes: 77, benefits: ["회원 그린피 면제", "주중 무제한"], verified: true },
  { id: "m12", courseName: "무등힐CC", region: "jeolla", kind: "법인 정회원", holes: 36, weekly: series(25_000, [0, 0, 0, 0, 0, 500, 0, 0, 0, 0, 0]), askPrice: null, bidPrice: 24_800 * MAN, likes: 64, benefits: ["무기명 2인", "주말 우선 부킹"], verified: false },
  { id: "m13", courseName: "한라윈드CC", region: "jeju", kind: "개인 정회원", holes: 27, weekly: series(4_300, [-100, 0, 0, 0, -50, 0, 0, 0, 0, 0, 50]), askPrice: 4_250 * MAN, bidPrice: 4_000 * MAN, likes: 156, benefits: ["회원 그린피 6만원", "항공권 제휴 할인"], verified: true },
  { id: "m14", courseName: "오름골드GC", region: "jeju", kind: "가족 회원", holes: 36, weekly: series(11_000, [0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0]), askPrice: 11_300 * MAN, bidPrice: 10_800 * MAN, likes: 88, benefits: ["가족 3인 등록", "리조트 30% 할인"], verified: true },
  { id: "m15", courseName: "대관령그린CC", region: "gangwon", kind: "개인 정회원", holes: 18, weekly: series(7_600, [0, 0, 0, 0, -100, 0, 0, 0, 0, 0, 0]), askPrice: 7_500 * MAN, bidPrice: 7_200 * MAN, likes: 349, benefits: ["회원 그린피 5만원", "스키 시즌권 할인"], verified: true },
  { id: "m16", courseName: "다이아몬드힐스CC", region: "seoul_gyeonggi", kind: "법인 정회원", holes: 27, weekly: series(152_000, [0, 0, 2_000, 0, 0, 0, 1_000, 0, 0, 0, 0]), askPrice: 156_000 * MAN, bidPrice: 152_000 * MAN, likes: 199, benefits: ["무기명 4인", "전용 라운지"], verified: true },
  // 같은 골프장의 다른 회원권 유형(상세 화면 "회원권 종류" 선택용, D-85)
  { id: "m17", courseName: "솔빛힐스CC", region: "seoul_gyeonggi", kind: "법인 정회원", holes: 27, weekly: series(52_000, [0, 200, 0, 0, 300, 0, 0, 0, -100, 0, 100]), askPrice: 53_000 * MAN, bidPrice: 51_000 * MAN, likes: 121, benefits: ["기명 2인 등록", "주말 우선 부킹"], verified: true },
  { id: "m18", courseName: "청람레이크CC", region: "seoul_gyeonggi", kind: "주중 회원", holes: 18, weekly: series(2_900, [0, 0, -50, 0, 0, 0, 0, 0, 0, 0, 50]), askPrice: 2_850 * MAN, bidPrice: 2_700 * MAN, likes: 84, benefits: ["주중 그린피 4만원"], verified: true },
];

export const findMarketItem = (id: string) => MARKET_ITEMS.find((i) => i.id === id) ?? null;

/** 기준 주차(목업) */
export const MARKET_WEEK_LABEL = "2026년 10월 4주차 기준";

/** 상단 "거래 체결" 티커 */
export const RECENT_DEALS = [
  { itemId: "m02", price: 4_800 * MAN },
  { itemId: "m15", price: 7_450 * MAN },
  { itemId: "m09", price: 32_000 * MAN },
  { itemId: "m13", price: 4_200 * MAN },
  { itemId: "m07", price: 8_650 * MAN },
] as const;

/** 홈 배너(이미지 대신 그라디언트 + 아이콘). href는 앱 안 경로 */
export const BANNERS = [
  { id: "guarantee", title: "안심 거래\n보장 제도", tone: "from-[#3b5fc0] to-[#9cc0f5]", icon: "shield", href: "/market/guide/guarantee" },
  { id: "metro", title: "수도권 가성비\n매물 모음", tone: "from-[#5a4fb8] to-[#b8b6e6]", icon: "building", href: "/market/search/results?region=seoul_gyeonggi&band=u50m,50m-1e" },
  { id: "report", title: "주간 시세\n리포트", tone: "from-[#1f5f4a] to-[#7fd1a8]", icon: "chart", href: "/market/report" },
] as const;

/**
 * 중개 수수료 정책(목업). 오너 확정 필요 — 실제 요율·정액·시행일은 약관과 함께 정한다.
 * 기준 금액 이하 정액 / 주중 회원 정액 / 초과분 요율(bp, 1bp = 0.01%)
 */
export const FEE_POLICY: FeePolicy = { threshold: 100_000_000, flat: 500_000, flatWeekday: 300_000, rateBp: 50 };
export const FEE_NOTICE = {
  effectiveDate: "2026-11-16",
  title: "거래 수수료 기준이 바뀝니다",
  body: "더 안정적인 거래 서비스를 위해 수수료 기준을 정리했습니다.",
  termsTitle: "서비스 이용약관 개정 안내",
  termsSummary: "거래 수수료 기준 변경(시행일 전에 등록한 판매 희망가는 기존 수수료를 적용합니다)",
} as const;

export const COUPONS = [
  { id: "c1", title: "첫 거래 수수료 20% 할인", expiresOn: "2026-12-31", minPrice: 30_000_000, used: false },
  { id: "c2", title: "판매 희망가 등록 감사 쿠폰 5만원", expiresOn: "2026-11-30", minPrice: 0, used: false },
  { id: "c3", title: "가을 라운드 응원 쿠폰 3만원", expiresOn: "2026-10-15", minPrice: 0, used: true },
] as const;

export type MarketNotification = { id: string; kind: "시세" | "안내" | "혜택"; title: string; body: string; at: string; read: boolean };
export const NOTIFICATIONS: readonly MarketNotification[] = [
  { id: "n1", kind: "시세", title: "관심 회원권 시세가 바뀌었어요", body: "청람레이크CC 이번 주 시세 4,800만원(0.0%)", at: "2026-10-23T09:00:00+09:00", read: false },
  { id: "n2", kind: "안내", title: "거래 수수료 기준 변경 안내", body: "2026년 11월 16일부터 새 수수료 기준이 적용됩니다.", at: "2026-10-21T10:00:00+09:00", read: false },
  { id: "n3", kind: "혜택", title: "첫 거래 수수료 20% 할인 쿠폰", body: "쿠폰함에서 확인하세요.", at: "2026-10-18T12:00:00+09:00", read: true },
] as const;

/** 나의 회원권(로그인 고객 목업): 보유 회원권 id와 취득가 */
export const MY_HOLDINGS = [
  { itemId: "m15", acquiredPrice: 7_000 * MAN, acquiredOn: "2023-04-12" },
] as const;

/** 판매 희망가(목업) */
export type MarketAsk = { id: string; itemId: string; price: number; status: "검토 중" | "공개 중" | "거래 완료"; createdAt: string };
export const MY_ASKS: readonly MarketAsk[] = [
  { id: "a1", itemId: "m15", price: 7_700 * MAN, status: "검토 중", createdAt: "2026-10-22T15:20:00+09:00" },
] as const;

export const FAQ = [
  { q: "회원권 거래는 어떤 순서로 진행되나요?", a: "구매 문의 → 담당자 상담 → 계약 → 잔금 → 명의개서 순서입니다. 계약과 명의개서는 담당자가 함께 진행합니다." },
  { q: "수수료는 언제 내나요?", a: "계약이 성사된 뒤 잔금일에 정산합니다. 상담과 시세 조회는 무료입니다." },
  { q: "판매 희망가를 등록하면 바로 공개되나요?", a: "담당자가 회원권 정보를 확인한 뒤 매물로 공개합니다. 확인 전에는 공개되지 않습니다." },
  { q: "명의개서 비용은 누가 부담하나요?", a: "골프장 규정에 따르며 보통 구매자가 부담합니다. 상담 때 예상 비용을 안내해 드립니다." },
] as const;

/** 고객센터(목업). 운영 전화번호·운영시간은 오너 확정 필요 */
export const SUPPORT = { hours: "평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)", phone: "1588-0000" } as const;

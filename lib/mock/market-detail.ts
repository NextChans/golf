import { hashString, randInt, seededRandom } from "@/lib/domain/market/seed";
import { monthlySeries, MARKET_BASE } from "@/lib/domain/market/detail";
import { MARKET_REGION_LABEL, type MarketItem } from "@/lib/domain/market/schema";
import type { Region } from "@/lib/domain/course/schema";

/**
 * 회원권 상세 목업(D-85). 골프장명·id를 시드로 결정론적으로 만든다(Math.random 없음).
 * 주소·전화·홈페이지·회원수·그린피는 전부 가상이며 실제 골프장과 무관하다.
 * 실데이터 연결 때 골프장 정보는 courses·membership_products에서 가져온다.
 */

const MAN = 10_000;

export type FeatureIcon = "flag" | "map-pin" | "star";
export type GreenFeeRow = { label: string; weekday: number | null; weekend: number | null };
export type AdmissionRow = { label: string; value: string };
export type DealRow = { date: string; price: number };

export type MarketDetail = {
  address: string;
  phone: { label: string; href: string };
  members: number;
  openedOn: string;
  features: { icon: FeatureIcon; title: string; desc: string }[];
  admission: { personal: AdmissionRow[]; corporate: AdmissionRow[] };
  companion: { headline: string; rows: string[] };
  bookingNotes: { title: string; lines: string[] }[];
  greenFees: GreenFeeRow[];
  cartFee: number;
  caddieFee: number;
  deals: DealRow[];
  listings: DealRow[];
  bids: DealRow[];
};

const ADDRESS_PREFIX: Record<Region, string> = {
  seoul_gyeonggi: "경기 가상시",
  gangwon: "강원 가상군",
  chungcheong: "충북 가상시",
  gyeongsang: "경남 가상시",
  jeolla: "전남 가상군",
  jeju: "제주 가상시",
};

const pad = (n: number) => String(n).padStart(2, "0");
const round5 = (n: number) => Math.round(n / 5_000) * 5_000;
const roundMan = (n: number) => Math.round(n / MAN) * MAN;

/** 기준 연월에서 N개월 전의 "YYYY.MM.DD" */
function dateMonthsAgo(months: number, day: number): string {
  const total = MARKET_BASE.year * 12 + (MARKET_BASE.month - 1) - months;
  return `${Math.floor(total / 12)}.${pad((total % 12) + 1)}.${pad(day)}`;
}

function companionOf(kind: MarketItem["kind"]): MarketDetail["companion"] {
  switch (kind) {
    case "개인 정회원": return { headline: "정회원 1명만 이용 가능해요", rows: ["정회원 1명"] };
    case "법인 정회원": return { headline: "법인이 지정한 이용자가 쓸 수 있어요", rows: ["기명 회원 2명", "무기명 이용자 1명"] };
    case "주중 회원": return { headline: "주중에만 본인이 이용 가능해요", rows: ["주중 회원 1명(주말·공휴일 제외)"] };
    case "가족 회원": return { headline: "등록한 가족이 함께 이용 가능해요", rows: ["가족 회원 본인", "등록 가족(인원은 골프장 규정에 따라 달라요)"] };
  }
}

export function getMarketDetail(item: MarketItem): MarketDetail {
  const course = seededRandom(hashString(`course:${item.courseName}`)); // 같은 골프장이면 유형이 달라도 같은 값
  const own = seededRandom(hashString(`item:${item.id}`));
  const region = MARKET_REGION_LABEL[item.region];

  const address = `${ADDRESS_PREFIX[item.region]} 예시로 ${randInt(course, 3, 98)}`;
  const members = randInt(course, 7, 20) * 100 + randInt(course, 0, 99);
  const openedOn = `${randInt(course, 1985, 2012)}년 ${pad(randInt(course, 1, 12))}월 ${pad(randInt(course, 1, 28))}일`;
  const base = 70_000 + randInt(course, 0, 12) * 5_000;
  const cartFee = 80_000 + randInt(course, 0, 4) * 10_000;
  const caddieFee = 120_000 + randInt(course, 0, 5) * 10_000;
  const greenFees: GreenFeeRow[] = [
    { label: "특별회원", weekday: round5(base * 0.85), weekend: round5(base * 0.9) },
    { label: "일반회원", weekday: base, weekend: round5(base * 1.12) },
    { label: "주중회원", weekday: round5(base * 0.95), weekend: null },
    { label: "비회원", weekday: round5(base * 1.9), weekend: round5(base * 2.3) },
  ];

  const special = randInt(course, 20, 30);
  const bookingNotes = [
    { title: "[예약 특이사항]", lines: ["대기 예약 가능(예약실 안내에 따라 순번대로 연락)", "예약 규칙은 골프장 사정에 따라 바뀔 수 있어요"] },
    { title: "[평일]", lines: [`특별회원 - ${special}일 전 10시 예약`, `일반회원 - ${special - 5}일 전 10시 예약`] },
    { title: "[주말]", lines: [`특별회원 - ${special}일 전 10시 예약`, `일반회원 - ${special - 5}일 전 10시 예약`] },
  ];

  const age = ["만 35세 이상 입회", "만 40세 이상 입회", "제한없음"][randInt(course, 0, 2)]!;
  const referral = randInt(course, 0, 1) === 0 ? "있음" : "없음";
  const admission = {
    personal: [
      { label: "연령", value: age },
      { label: "성별", value: "제한없음" },
      { label: "추천인", value: referral },
      { label: "심사", value: "있음" },
      { label: "기타", value: "없음" },
    ],
    corporate: [
      { label: "연령", value: "제한없음" },
      { label: "성별", value: "제한없음" },
      { label: "추천인", value: "있음" },
      { label: "심사", value: "있음(법인 서류 확인)" },
      { label: "기타", value: "법인 대표자·임원 명의로 입회" },
    ],
  };

  const kindTitle = { "개인 정회원": "개인 명의 정회원권", "법인 정회원": "법인 명의 이용 혜택", "주중 회원": "주중 이용에 알맞은 회원권", "가족 회원": "가족과 함께 이용" }[item.kind];
  const features: MarketDetail["features"] = [
    { icon: "flag", title: `${item.holes}홀 코스`, desc: `${item.holes}홀 규모라 코스 조합이 다양하고 타임을 고르기 쉬운 편이에요.(예시 설명)` },
    { icon: "map-pin", title: `${region} 접근성`, desc: `${region}에서 이동하기 좋은 위치를 가정한 예시 설명이에요. 실제 위치와 이동 시간은 상담 때 확인해 주세요.` },
    { icon: "star", title: kindTitle, desc: `${item.benefits.slice(0, 2).join(", ")} 같은 혜택을 예시로 보여 드려요. 혜택은 골프장 정책에 따라 달라질 수 있어요.` },
  ];

  // 체결 거래: 월별 시세 근처의 가격, 최근 거래가 맨 위
  const monthly = monthlySeries(item);
  const dealMonths = [1, 3, 5, 8, 12];
  const deals = dealMonths.map((m) => ({
    date: dateMonthsAgo(m, randInt(own, 2, 24)),
    price: roundMan(monthly[monthly.length - 1 - m]! * (0.985 + own() * 0.03)),
  }));

  const listings: DealRow[] = item.askPrice === null ? [] : [0, 1, 2].slice(0, randInt(own, 1, 3)).map((k) => ({
    date: dateMonthsAgo(0, 20 - k * 4),
    price: roundMan(item.askPrice! * (1 + k * 0.012)),
  }));
  const bids: DealRow[] = item.bidPrice === null ? [] : [0, 1, 2].slice(0, randInt(own, 1, 3)).map((k) => ({
    date: dateMonthsAgo(0, 22 - k * 5),
    price: roundMan(item.bidPrice! * (1 - k * 0.01)),
  }));

  return {
    address,
    phone: { label: "000-000-0000(예시)", href: "tel:000-000-0000" },
    members, openedOn, features, admission, companion: companionOf(item.kind), bookingNotes,
    greenFees, cartFee, caddieFee, deals, listings, bids,
  };
}

/** 같은 골프장의 회원권 유형 목록(상세 화면 "회원권 종류" 선택) */
export function siblingKinds(items: readonly MarketItem[], item: MarketItem): { id: string; kind: MarketItem["kind"] }[] {
  return items.filter((i) => i.courseName === item.courseName).map((i) => ({ id: i.id, kind: i.kind }));
}

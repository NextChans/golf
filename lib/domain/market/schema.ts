import { REGION_LABEL, type Region } from "@/lib/domain/course/schema";

/**
 * 회원권 앱(/market) 도메인 규칙(D-80). UI와 분리한 순수 함수라 Vitest로 검증한다.
 * 데이터는 지금은 목업(lib/mock/market.ts)이고, 실데이터 연결 때 같은 타입으로 바꿔 끼운다.
 */

export type MembershipKind = "개인 정회원" | "법인 정회원" | "주중 회원" | "가족 회원";

export type MarketItem = {
  id: string;
  /** 골프장 id(같은 골프장의 유형들이 공유, 예 "c01") */
  courseId: string;
  courseName: string;
  region: Region;
  kind: MembershipKind;
  /** 유형 라벨(그린판다식, 예 "정회원 분1.5억"). 없으면 kind */
  label?: string;
  holes: 18 | 27 | 36;
  /** 최근 12주 시세(원), 오래된 주 → 이번 주 */
  weekly: number[];
  /** 즉시 구매가(판매 호가 최저, 원). 없으면 매물 없음 */
  askPrice: number | null;
  /** 즉시 판매가(구매 입찰 최고, 원) */
  bidPrice: number | null;
  /** 관심 수(인기순) */
  likes: number;
  benefits: string[];
  verified: boolean;
};

/** 탐색 지역(앱 표기). DB REGIONS와 같은 값이고 라벨만 앱 표기("수도권")로 바꾼다 */
export const MARKET_REGION_LABEL: Record<Region, string> = { ...REGION_LABEL, seoul_gyeonggi: "수도권" };
export const MARKET_REGIONS = ["seoul_gyeonggi", "gangwon", "chungcheong", "gyeongsang", "jeolla", "jeju"] as const satisfies readonly Region[];

const EOK = 100_000_000;
const MAN = 10_000;

/** 가격대(하한 포함·상한 미포함, 원) */
export const PRICE_BANDS = [
  { id: "u50m", label: "5000만원 미만", min: 0, max: 5_000 * MAN },
  { id: "50m-1e", label: "5000만원 ~ 1억원 미만", min: 5_000 * MAN, max: EOK },
  { id: "1e-2e", label: "1억원 ~ 2억원 미만", min: EOK, max: 2 * EOK },
  { id: "2e-3e", label: "2억원 ~ 3억원 미만", min: 2 * EOK, max: 3 * EOK },
  { id: "3e-5e", label: "3억원 ~ 5억원 미만", min: 3 * EOK, max: 5 * EOK },
  { id: "5e-9e", label: "5억원 ~ 9억원 미만", min: 5 * EOK, max: 9 * EOK },
  { id: "o9e", label: "9억원 이상", min: 9 * EOK, max: Number.POSITIVE_INFINITY },
] as const;
export type PriceBandId = (typeof PRICE_BANDS)[number]["id"];

export const LIST_TABS = [
  { id: "instant", label: "즉시 구매" },
  { id: "popular", label: "인기" },
  { id: "rising", label: "상승" },
  { id: "falling", label: "하락" },
] as const;
export type ListTab = (typeof LIST_TABS)[number]["id"];

export const currentPrice = (item: Pick<MarketItem, "weekly">) => item.weekly[item.weekly.length - 1] ?? 0;

/** 전주 대비 변화율(%). 소수 1자리. 이전 값이 없거나 0이면 0 */
export function weeklyChangeRate(series: readonly number[]): number {
  if (series.length < 2) return 0;
  const prev = series[series.length - 2]!;
  const cur = series[series.length - 1]!;
  if (!prev) return 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** 여러 회원권의 주별 평균 시세(원 단위 반올림). 길이가 다르면 짧은 쪽에 맞춰 최근 주끼리 맞춘다 */
export function averageSeries(items: readonly Pick<MarketItem, "weekly">[]): number[] {
  if (!items.length) return [];
  const len = Math.min(...items.map((i) => i.weekly.length));
  return Array.from({ length: len }, (_, k) => {
    const sum = items.reduce((acc, i) => acc + i.weekly[i.weekly.length - len + k]!, 0);
    return Math.round(sum / items.length);
  });
}

/** "3억 3,874만원" — 만원 미만은 버린다(시세 표기). 1만원 미만이면 "0원" */
export function formatManWon(amount: number): string {
  if (!Number.isFinite(amount) || amount < MAN) return "0원";
  const fmt = new Intl.NumberFormat("ko-KR");
  const eok = Math.floor(amount / EOK);
  const man = Math.floor((amount % EOK) / MAN);
  if (eok && man) return `${fmt.format(eok)}억 ${fmt.format(man)}만원`;
  if (eok) return `${fmt.format(eok)}억원`;
  return `${fmt.format(man)}만원`;
}

/** 변화율 표기: "+1.2%", "-0.4%", "0.0%" */
export function formatRate(rate: number): string {
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(1)}%`;
}

export type MarketFilter = { regions: Region[]; bands: PriceBandId[]; q: string };

const isRegion = (v: string): v is Region => (MARKET_REGIONS as readonly string[]).includes(v);
const isBand = (v: string): v is PriceBandId => PRICE_BANDS.some((b) => b.id === v);
const toList = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? v.split(",") : []).map((s) => s.trim()).filter(Boolean);

/** URL 쿼리(?region=gangwon,jeju&band=1e-2e&q=용평) → 필터. 모르는 값은 버리고 중복은 합친다 */
export function parseMarketFilter(sp: Record<string, string | string[] | undefined>): MarketFilter {
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 40) ?? "";
  return {
    regions: [...new Set(toList(sp.region).filter(isRegion))],
    bands: [...new Set(toList(sp.band).filter(isBand))],
    q,
  };
}

export function filterToQuery(f: MarketFilter): string {
  const p = new URLSearchParams();
  if (f.regions.length) p.set("region", f.regions.join(","));
  if (f.bands.length) p.set("band", f.bands.join(","));
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** 검색어는 공백 무시·대소문자 무시로 골프장명·지역명에 부분 일치 */
export function matchesQuery(item: Pick<MarketItem, "courseName" | "region">, q: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const needle = norm(q);
  if (!needle) return true;
  return norm(item.courseName).includes(needle) || norm(MARKET_REGION_LABEL[item.region]).includes(needle);
}

/** 지역은 OR, 가격대는 OR, 지역·가격대·검색어 사이는 AND. 가격 기준은 이번 주 시세 */
export function applyMarketFilter<T extends MarketItem>(items: readonly T[], f: MarketFilter): T[] {
  return items.filter((i) => {
    if (f.regions.length && !f.regions.includes(i.region)) return false;
    if (f.bands.length) {
      const price = currentPrice(i);
      const inBand = f.bands.some((id) => {
        const b = PRICE_BANDS.find((x) => x.id === id)!;
        return price >= b.min && price < b.max;
      });
      if (!inBand) return false;
    }
    return matchesQuery(i, f.q);
  });
}

/** 홈 목록 탭 정렬: 즉시 구매(매물 있는 것, 낮은 가격순)·인기(관심 수)·상승/하락(변화율) */
export function sortForTab<T extends MarketItem>(items: readonly T[], tab: ListTab): T[] {
  const list = [...items];
  switch (tab) {
    case "instant":
      return list.filter((i) => i.askPrice !== null).sort((a, b) => a.askPrice! - b.askPrice!);
    case "popular":
      return list.sort((a, b) => b.likes - a.likes);
    case "rising":
      return list.filter((i) => weeklyChangeRate(i.weekly) > 0).sort((a, b) => weeklyChangeRate(b.weekly) - weeklyChangeRate(a.weekly));
    case "falling":
      return list.filter((i) => weeklyChangeRate(i.weekly) < 0).sort((a, b) => weeklyChangeRate(a.weekly) - weeklyChangeRate(b.weekly));
  }
}

/**
 * 중개 수수료(원). 기준 금액 이하는 정액(주중 회원은 별도 정액), 초과는 거래금액 × 요율(원 미만 버림).
 * 요율·정액은 오너 확정 전 목업 값(lib/mock/market.ts FEE_POLICY)이다.
 */
export type FeePolicy = { threshold: number; flat: number; flatWeekday: number; rateBp: number };
export function brokerageFee(price: number, kind: MembershipKind, policy: FeePolicy): number {
  if (price <= policy.threshold) return kind === "주중 회원" ? policy.flatWeekday : policy.flat;
  return Math.floor((price * policy.rateBp) / 10_000);
}

/** 팝업 "오늘 그만 보기": KST 날짜(YYYY-MM-DD)를 저장하고 같은 날이면 숨긴다 */
export function kstDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function isDismissedToday(stored: string | null, now: Date): boolean {
  return stored === kstDateKey(now);
}

/** 목록·카드에 보이는 유형 이름: label이 있으면 label, 없으면 kind */
export const itemLabel = (item: Pick<MarketItem, "kind" | "label">) => item.label ?? item.kind;

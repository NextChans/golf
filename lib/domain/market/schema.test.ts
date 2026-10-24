import { describe, expect, it } from "vitest";
import { FEE_POLICY, MARKET_ITEMS } from "@/lib/mock/market";
import {
  applyMarketFilter, averageSeries, brokerageFee, currentPrice, filterToQuery, formatManWon, formatRate,
  isDismissedToday, kstDateKey, matchesQuery, parseMarketFilter, PRICE_BANDS, sortForTab, weeklyChangeRate,
  type MarketItem,
} from "./schema";

const item = (over: Partial<MarketItem>): MarketItem => ({
  id: "x", courseId: "cx", courseName: "테스트CC", region: "jeju", kind: "개인 정회원", holes: 18, weekly: [100_000_000],
  askPrice: null, bidPrice: null, likes: 0, benefits: [], verified: true, ...over,
});

describe("formatManWon", () => {
  it("억·만원 단위로 표기하고 만원 미만은 버린다", () => {
    expect(formatManWon(338_745_678)).toBe("3억 3,874만원");
    expect(formatManWon(48_000_000)).toBe("4,800만원");
    expect(formatManWon(200_000_000)).toBe("2억원");
    expect(formatManWon(1_520_000_000)).toBe("15억 2,000만원");
    expect(formatManWon(9_999)).toBe("0원");
    expect(formatManWon(Number.NaN)).toBe("0원");
  });
});

describe("weeklyChangeRate·formatRate", () => {
  it("전주 대비 변화율을 소수 1자리로", () => {
    expect(weeklyChangeRate([100, 101.25])).toBe(1.3);
    expect(weeklyChangeRate([200, 199])).toBe(-0.5);
    expect(weeklyChangeRate([100])).toBe(0);
    expect(weeklyChangeRate([0, 100])).toBe(0);
  });
  it("부호를 붙여 표기", () => {
    expect(formatRate(1.25)).toBe("+1.3%");
    expect(formatRate(-0.4)).toBe("-0.4%");
    expect(formatRate(0)).toBe("0.0%");
  });
});

describe("averageSeries", () => {
  it("주별 평균, 길이가 다르면 최근 주끼리 맞춘다", () => {
    expect(averageSeries([{ weekly: [10, 20, 30] }, { weekly: [40, 50] }])).toEqual([30, 40]);
    expect(averageSeries([])).toEqual([]);
  });
});

describe("parseMarketFilter·filterToQuery", () => {
  it("모르는 값과 중복을 버린다", () => {
    const f = parseMarketFilter({ region: "jeju,mars,jeju", band: ["1e-2e", "zzz"], q: "  용평  " });
    expect(f).toEqual({ regions: ["jeju"], bands: ["1e-2e"], q: "용평" });
  });
  it("빈 필터는 빈 쿼리", () => {
    expect(filterToQuery(parseMarketFilter({}))).toBe("");
  });
  it("왕복 변환", () => {
    const f = { regions: ["gangwon", "jeju"] as const, bands: ["u50m"] as const, q: "한라" };
    const qs = filterToQuery({ ...f, regions: [...f.regions], bands: [...f.bands] });
    expect(parseMarketFilter(Object.fromEntries(new URLSearchParams(qs)))).toEqual({ ...f, regions: [...f.regions], bands: [...f.bands] });
  });
  it("검색어는 40자로 자른다", () => {
    expect(parseMarketFilter({ q: "가".repeat(50) }).q).toHaveLength(40);
  });
});

describe("applyMarketFilter", () => {
  const a = item({ id: "a", region: "jeju", weekly: [49_990_000] });
  const b = item({ id: "b", region: "gangwon", weekly: [50_000_000], courseName: "설원 마운틴GC" });
  const c = item({ id: "c", region: "gangwon", weekly: [900_000_000] });
  it("가격대는 하한 포함·상한 미포함", () => {
    expect(applyMarketFilter([a, b], { regions: [], bands: ["u50m"], q: "" }).map((i) => i.id)).toEqual(["a"]);
    expect(applyMarketFilter([a, b], { regions: [], bands: ["50m-1e"], q: "" }).map((i) => i.id)).toEqual(["b"]);
    expect(applyMarketFilter([c], { regions: [], bands: ["o9e"], q: "" }).map((i) => i.id)).toEqual(["c"]);
  });
  it("지역 OR, 조건 사이 AND", () => {
    expect(applyMarketFilter([a, b, c], { regions: ["jeju", "gangwon"], bands: ["u50m", "o9e"], q: "" }).map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("검색어는 공백·지역명까지 부분 일치", () => {
    expect(matchesQuery(b, "설원마운틴")).toBe(true);
    expect(matchesQuery(b, "강원")).toBe(true);
    expect(matchesQuery(a, "수도권")).toBe(false);
  });
  it("가격대 정의가 빈틈 없이 이어진다", () => {
    for (let k = 1; k < PRICE_BANDS.length; k++) expect(PRICE_BANDS[k]!.min).toBe(PRICE_BANDS[k - 1]!.max);
  });
});

describe("sortForTab", () => {
  it("즉시 구매는 매물 있는 것만 낮은 가격순", () => {
    const list = sortForTab(MARKET_ITEMS, "instant");
    expect(list.every((i) => i.askPrice !== null)).toBe(true);
    expect(list.map((i) => i.askPrice)).toEqual([...list.map((i) => i.askPrice!)].sort((x, y) => x - y));
  });
  it("상승·하락은 부호가 맞는 것만", () => {
    expect(sortForTab(MARKET_ITEMS, "rising").every((i) => weeklyChangeRate(i.weekly) > 0)).toBe(true);
    expect(sortForTab(MARKET_ITEMS, "falling").every((i) => weeklyChangeRate(i.weekly) < 0)).toBe(true);
  });
  it("인기는 관심 수 내림차순", () => {
    const likes = sortForTab(MARKET_ITEMS, "popular").map((i) => i.likes);
    expect(likes).toEqual([...likes].sort((x, y) => y - x));
  });
});

describe("brokerageFee", () => {
  it("기준 이하 정액(주중 회원 별도), 초과는 요율", () => {
    expect(brokerageFee(100_000_000, "개인 정회원", FEE_POLICY)).toBe(500_000);
    expect(brokerageFee(30_000_000, "주중 회원", FEE_POLICY)).toBe(300_000);
    expect(brokerageFee(100_000_001, "개인 정회원", FEE_POLICY)).toBe(500_000);
    expect(brokerageFee(480_000_000, "개인 정회원", FEE_POLICY)).toBe(2_400_000);
  });
});

describe("오늘 그만 보기(KST)", () => {
  it("KST 날짜 경계로 판정", () => {
    const beforeMidnight = new Date("2026-10-24T14:59:00Z"); // KST 23:59
    const afterMidnight = new Date("2026-10-24T15:00:00Z"); // KST 다음날 00:00
    expect(kstDateKey(beforeMidnight)).toBe("2026-10-24");
    expect(isDismissedToday("2026-10-24", beforeMidnight)).toBe(true);
    expect(isDismissedToday("2026-10-24", afterMidnight)).toBe(false);
    expect(isDismissedToday(null, afterMidnight)).toBe(false);
  });
});

describe("목업 데이터", () => {
  it("12주 시세와 고유 id", () => {
    expect(new Set(MARKET_ITEMS.map((i) => i.id)).size).toBe(MARKET_ITEMS.length);
    expect(MARKET_ITEMS.every((i) => i.weekly.length === 12 && currentPrice(i) > 0)).toBe(true);
  });
});

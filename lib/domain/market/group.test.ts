import { describe, expect, it } from "vitest";
import { MARKET_ITEMS } from "@/lib/mock/market";
import { getCourseDetail, getMarketDetail } from "@/lib/mock/market-detail";
import {
  countAppliedFilters, filterButtonLabel, findCourseGroup, groupByCourse, parseSort, sortGroups, sortKeyValue,
} from "./group";
import { currentPrice, itemLabel, weeklyChangeRate, type MarketItem } from "./schema";

const mk = (id: string, courseId: string, price: number, likes: number, prev = price): MarketItem => ({
  id, courseId, courseName: `${courseId}CC`, region: "jeju", kind: "개인 정회원", holes: 18, weekly: [prev, price],
  askPrice: null, bidPrice: null, likes, benefits: [], verified: true,
});

describe("groupByCourse", () => {
  it("courseId로 묶고 첫 등장 순서를 지키며 유형은 시세 높은 순", () => {
    const groups = groupByCourse([mk("a", "c1", 100, 1), mk("b", "c2", 50, 1), mk("c", "c1", 300, 1)]);
    expect(groups.map((g) => g.courseId)).toEqual(["c1", "c2"]);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["c", "a"]);
  });
  it("목업은 모든 항목이 courseId를 갖고, 같은 courseId는 같은 골프장명·지역·홀이며, 유형이 2개 이상인 골프장이 6곳 이상", () => {
    for (const g of groupByCourse(MARKET_ITEMS)) {
      expect(new Set(g.items.map((i) => i.courseName)).size).toBe(1);
      expect(new Set(g.items.map((i) => i.holes)).size).toBe(1);
      expect(new Set(g.items.map((i) => i.region)).size).toBe(1);
      expect(new Set(g.items.map((i) => itemLabel(i))).size).toBe(g.items.length);
    }
    expect(groupByCourse(MARKET_ITEMS).filter((g) => g.items.length >= 2).length).toBeGreaterThanOrEqual(6);
  });
  it("추가한 항목도 12주 시세를 갖는다", () => {
    expect(MARKET_ITEMS.every((i) => i.weekly.length === 12 && i.benefits.length > 0 && i.likes > 0)).toBe(true);
  });
});

describe("findCourseGroup", () => {
  it("courseId로 그 골프장의 모든 유형을 찾고 없으면 null", () => {
    expect(findCourseGroup(MARKET_ITEMS, "c01")?.items.map((i) => i.id).sort()).toEqual(["m01", "m17"]);
    expect(findCourseGroup(MARKET_ITEMS, "zzz")).toBeNull();
  });
  it("골프장 단위 상세는 같은 골프장의 유형끼리 주소·전화·회원수를 공유한다", () => {
    const a = getMarketDetail(MARKET_ITEMS.find((i) => i.id === "m01")!);
    const b = getMarketDetail(MARKET_ITEMS.find((i) => i.id === "m17")!);
    const c = getCourseDetail(MARKET_ITEMS, "c01")!;
    expect([a.address, a.members, a.openedOn, a.phone.label]).toEqual([b.address, b.members, b.openedOn, b.phone.label]);
    expect(c.address).toBe(a.address);
    expect(getCourseDetail(MARKET_ITEMS, "zzz")).toBeNull();
  });
});

describe("정렬", () => {
  const groups = groupByCourse([
    mk("a1", "A", 300, 10, 300), mk("a2", "A", 100, 10, 100),
    mk("b1", "B", 200, 50, 190), // +5.3%
    mk("c1", "C", 150, 5, 160), mk("c2", "C", 400, 5, 400), // 최소 -6.3%, 최대 0
  ]);
  const order = (s: Parameters<typeof sortGroups>[1]) => sortGroups(groups, s).map((g) => g.courseId);

  it("인기순은 관심 수 합계 큰 순", () => expect(order("popular")).toEqual(["B", "A", "C"]));
  it("가격 낮은순은 유형 중 최저가 오름차순", () => {
    expect(sortKeyValue(groups.find((g) => g.courseId === "A")!, "price_asc")).toBe(100);
    expect(order("price_asc")).toEqual(["A", "C", "B"]);
  });
  it("가격 높은순은 최저가 내림차순", () => expect(order("price_desc")).toEqual(["B", "C", "A"]));
  it("상승률순은 유형 중 최대 변화율이 큰 순", () => expect(order("rise")).toEqual(["B", "A", "C"]));
  it("하락률순은 유형 중 최소 변화율이 작은 순", () => expect(order("fall")).toEqual(["C", "A", "B"]));
  it("원본 배열을 바꾸지 않는다", () => {
    const before = groups.map((g) => g.courseId);
    sortGroups(groups, "price_desc");
    expect(groups.map((g) => g.courseId)).toEqual(before);
  });
  it("목업에서도 가격 낮은순 첫 골프장은 전체 최저 시세를 가진다", () => {
    const first = sortGroups(groupByCourse(MARKET_ITEMS), "price_asc")[0]!;
    expect(Math.min(...first.items.map(currentPrice))).toBe(Math.min(...MARKET_ITEMS.map(currentPrice)));
    const rise = sortGroups(groupByCourse(MARKET_ITEMS), "rise")[0]!;
    expect(Math.max(...rise.items.map((i) => weeklyChangeRate(i.weekly)))).toBe(Math.max(...MARKET_ITEMS.map((i) => weeklyChangeRate(i.weekly))));
  });
});

describe("parseSort", () => {
  it("알려진 값만 받고 나머지는 인기순", () => {
    expect(parseSort("price_asc")).toBe("price_asc");
    expect(parseSort(["fall", "rise"])).toBe("fall");
    expect(parseSort("bogus")).toBe("popular");
    expect(parseSort(undefined)).toBe("popular");
    expect(parseSort("")).toBe("popular");
  });
});

describe("적용 필터 개수", () => {
  it("지역 수 + 가격대 수 + 검색어 유무", () => {
    expect(countAppliedFilters({ regions: [], bands: [], q: "" })).toBe(0);
    expect(countAppliedFilters({ regions: ["gangwon", "jeju"], bands: ["1e-2e"], q: "" })).toBe(3);
    expect(countAppliedFilters({ regions: ["gangwon"], bands: [], q: "백운" })).toBe(2);
    expect(countAppliedFilters({ regions: [], bands: [], q: "  " })).toBe(0);
  });
  it("버튼 문구", () => {
    expect(filterButtonLabel({ regions: [], bands: [], q: "" })).toBe("필터");
    expect(filterButtonLabel({ regions: ["gangwon"], bands: ["1e-2e"], q: "" })).toBe("필터 · 2개 적용됨");
  });
});

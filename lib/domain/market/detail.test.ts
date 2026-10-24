import { describe, expect, it } from "vitest";
import { brokerageFee, currentPrice } from "./schema";
import {
  axisLabels, calcCost, clampManWon, MAX_MAN_WON, monthlySeries, parseManWon, periodChange, periodMinMax, periodSeries,
  trendSentence, validateManWon,
} from "./detail";
import { FEE_POLICY, MARKET_ITEMS } from "@/lib/mock/market";
import { getMarketDetail, siblingKinds } from "@/lib/mock/market-detail";

const item = MARKET_ITEMS.find((i) => i.id === "m05")!;

describe("월별·기간 시세", () => {
  it("월별 시세는 61점이고 끝값이 현재 시세이며 항상 같은 값이다", () => {
    const a = monthlySeries(item);
    expect(a).toHaveLength(61);
    expect(a[60]).toBe(currentPrice(item));
    expect(monthlySeries(item)).toEqual(a);
    expect(a.every((v) => v > 0 && v % 10_000 === 0)).toBe(true);
  });
  it("12주 시세와 최근 3개월이 이어진다", () => {
    const a = monthlySeries(item);
    expect(a[57]).toBe(item.weekly[0]);
    expect(a[58]).toBe(item.weekly[4]);
  });
  it("모든 회원권에서 기간별 길이·끝값이 맞다", () => {
    for (const i of MARKET_ITEMS) {
      for (const [p, n] of [["6m", 7], ["1y", 13], ["3y", 37], ["all", 61]] as const) {
        const s = periodSeries(i, p);
        expect(s).toHaveLength(n);
        expect(s[s.length - 1]).toBe(currentPrice(i));
      }
    }
  });
  it("회원권마다 다른 흐름이다", () => {
    expect(monthlySeries(MARKET_ITEMS[0]!)).not.toEqual(monthlySeries(MARKET_ITEMS[1]!));
  });
  it("기간 변화율은 소수 1자리, 값이 없으면 0", () => {
    expect(periodChange([100, 139])).toBe(39);
    expect(periodChange([300, 299])).toBe(-0.3);
    expect(periodChange([0, 5])).toBe(0);
    expect(periodChange([5])).toBe(0);
  });
  it("최고·최저와 위치", () => {
    expect(periodMinMax([5, 9, 2, 7])).toEqual({ min: 2, max: 9, minIndex: 2, maxIndex: 1 });
    expect(periodMinMax([4, 4])).toMatchObject({ min: 4, max: 4, minIndex: 0, maxIndex: 0 });
  });
  it("가로축 연월", () => {
    expect(axisLabels("3y")).toEqual({ start: "23.10", end: "26.10" });
    expect(axisLabels("6m")).toEqual({ start: "26.04", end: "26.10" });
    expect(axisLabels("all").start).toBe("21.10");
  });
});

describe("시세 동향 문장", () => {
  it("상승·하락·보합", () => {
    expect(trendSentence("3y", 39)).toMatchObject({ text: "최근 3년간 +39.0% 이상 상승했어요", tone: "up" });
    expect(trendSentence("6m", -5.2)).toMatchObject({ text: "최근 6개월간 -5.2% 하락했어요", tone: "down" });
    expect(trendSentence("1y", 0)).toMatchObject({ text: "최근 1년간 변동이 없어요", tone: "flat" });
    expect(trendSentence("all", 3).text).toBe("전체 기간 동안 +3.0% 이상 상승했어요");
  });
});

describe("거래 비용 계산기", () => {
  it("구매 = 금액 + 수수료, 판매 = 금액 − 수수료", () => {
    const price = 11_400 * 10_000; // 1억 1,400만원 → 기준 초과, 요율 적용
    const fee = brokerageFee(price, "개인 정회원", FEE_POLICY);
    expect(calcCost("buy", price, "개인 정회원")).toEqual({ fee, total: price + fee });
    expect(calcCost("sell", price, "개인 정회원")).toEqual({ fee, total: price - fee });
    expect(fee).toBe(Math.floor((price * FEE_POLICY.rateBp) / 10_000));
  });
  it("기준 이하는 정액(주중 회원은 별도)", () => {
    expect(calcCost("buy", 5_000 * 10_000, "개인 정회원").fee).toBe(FEE_POLICY.flat);
    expect(calcCost("buy", 5_000 * 10_000, "주중 회원").fee).toBe(FEE_POLICY.flatWeekday);
  });
  it("판매 수령액은 음수가 되지 않는다", () => {
    expect(calcCost("sell", 100_000, "개인 정회원").total).toBe(0);
    expect(calcCost("sell", 0, "개인 정회원")).toEqual({ fee: 0, total: 0 });
    expect(calcCost("buy", -5, "개인 정회원")).toEqual({ fee: 0, total: 0 });
  });
  it("금액 보정·파싱·검사", () => {
    expect(clampManWon(-3)).toBe(0);
    expect(clampManWon(Number.NaN)).toBe(0);
    expect(clampManWon(10.6)).toBe(11);
    expect(clampManWon(MAX_MAN_WON + 1)).toBe(MAX_MAN_WON);
    expect(parseManWon("1,140 만원")).toBe(1140);
    expect(parseManWon("")).toBeNull();
    expect(validateManWon(null)).not.toBeNull();
    expect(validateManWon(0)).not.toBeNull();
    expect(validateManWon(MAX_MAN_WON + 1)).not.toBeNull();
    expect(validateManWon(MAX_MAN_WON)).toBeNull();
    expect(validateManWon(1)).toBeNull();
  });
});

describe("상세 목업 데이터", () => {
  it("결정론적이고 모든 회원권에 값이 있다", () => {
    for (const i of MARKET_ITEMS) {
      const d = getMarketDetail(i);
      expect(getMarketDetail(i)).toEqual(d);
      expect(d.address).toContain("가상");
      expect(d.phone.label).toContain("예시");
      expect(d.greenFees).toHaveLength(4);
      expect(d.features).toHaveLength(3);
      expect(d.deals.length).toBeGreaterThan(0);
      expect(d.listings.length > 0).toBe(i.askPrice !== null);
      expect(d.bids.length > 0).toBe(i.bidPrice !== null);
      if (i.askPrice !== null) expect(d.listings[0]!.price).toBe(i.askPrice);
    }
  });
  it("같은 골프장 두 유형이 있는 곳은 2곳", () => {
    const multi = new Set(MARKET_ITEMS.map((i) => i.courseName).filter((n) => MARKET_ITEMS.filter((i) => i.courseName === n).length > 1));
    expect(multi.size).toBe(7);
    expect(siblingKinds(MARKET_ITEMS, MARKET_ITEMS.find((i) => i.id === "m01")!).map((s) => s.id)).toEqual(["m01", "m17"]);
  });
});

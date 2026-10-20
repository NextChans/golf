import { describe, expect, it } from "vitest";
import {
  buyInquirySchema, cancelDealSchema, formatKoreanPrice, MAX_DEAL_PRICE, parseBuyInquiryForm,
  parseListingFilters, parseSellInquiryForm, sellInquirySchema,
} from "./schema";
import { customerCanCancel, DEAL_STAGES, stageIndex } from "./status";

const KEY = "6f1c3a52-8f3e-4b8a-9c1d-2e5f7a9b0c11";
const LISTING = "00000000-0000-4000-c000-000000000001";
const PRODUCT = "00000000-0000-4000-b000-000000000001";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join("."));

describe("buyInquirySchema", () => {
  it("선택 항목이 비면 null로 정규화한다", () => {
    const r = parseBuyInquiryForm(form({ idempotencyKey: KEY, listingId: LISTING, desiredPrice: "", contactWindow: "  ", note: "" }));
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ idempotencyKey: KEY, listingId: LISTING, desiredPrice: null, contactWindow: null, note: null });
  });
  it("쉼표 금액을 숫자로 바꾸고 문자열을 trim한다", () => {
    const r = parseBuyInquiryForm(form({
      idempotencyKey: KEY, listingId: LISTING, desiredPrice: "310,000,000", contactWindow: " 평일 오후 ", note: " 급매 문의 ",
    }));
    expect(r.data).toMatchObject({ desiredPrice: 310_000_000, contactWindow: "평일 오후", note: "급매 문의" });
  });
  it("멱등키·매물 id가 uuid가 아니면 실패", () => {
    expect(paths(buyInquirySchema.safeParse({ idempotencyKey: "x", listingId: LISTING }))).toContain("idempotencyKey");
    expect(paths(buyInquirySchema.safeParse({ idempotencyKey: KEY, listingId: "1" }))).toContain("listingId");
  });
  it("희망가: 0·음수·소수·문자·상한 초과는 실패", () => {
    for (const desiredPrice of ["0", "-1", "1.5", "abc", String(MAX_DEAL_PRICE + 1)]) {
      const r = parseBuyInquiryForm(form({ idempotencyKey: KEY, listingId: LISTING, desiredPrice }));
      expect(paths(r), desiredPrice).toEqual(["desiredPrice"]);
    }
    expect(parseBuyInquiryForm(form({ idempotencyKey: KEY, listingId: LISTING, desiredPrice: String(MAX_DEAL_PRICE) })).success).toBe(true);
  });
  it("연락 가능 시간 100자, 요청사항 1000자 제한", () => {
    const ok = parseBuyInquiryForm(form({ idempotencyKey: KEY, listingId: LISTING, contactWindow: "가".repeat(100), note: "나".repeat(1000) }));
    expect(ok.success).toBe(true);
    const bad = parseBuyInquiryForm(form({ idempotencyKey: KEY, listingId: LISTING, contactWindow: "가".repeat(101), note: "나".repeat(1001) }));
    expect(paths(bad).sort()).toEqual(["contactWindow", "note"]);
  });
});

describe("sellInquirySchema", () => {
  it("상품 필수", () => {
    const r = parseSellInquiryForm(form({ idempotencyKey: KEY, productId: "" }));
    expect(paths(r)).toEqual(["productId"]);
    expect(r.success ? "" : r.error.issues[0]!.message).toBe("회원권을 선택해 주세요.");
  });
  it("정상 입력", () => {
    const r = sellInquirySchema.safeParse({ idempotencyKey: KEY, productId: PRODUCT, desiredPrice: "300,000,000", contactWindow: null, note: null });
    expect(r.success && r.data.desiredPrice).toBe(300_000_000);
  });
});

describe("cancelDealSchema", () => {
  it("사유는 선택, 500자 제한, version은 1 이상", () => {
    expect(cancelDealSchema.safeParse({ dealId: LISTING, expectedVersion: 1, reason: "" }).data?.reason).toBeNull();
    expect(paths(cancelDealSchema.safeParse({ dealId: LISTING, expectedVersion: 0, reason: null }))).toEqual(["expectedVersion"]);
    expect(paths(cancelDealSchema.safeParse({ dealId: LISTING, expectedVersion: 2, reason: "가".repeat(501) }))).toEqual(["reason"]);
  });
});

describe("parseListingFilters", () => {
  it("기본값: 필터 없음, 낮은 가격순", () => {
    expect(parseListingFilters({})).toEqual({
      region: null, minManWon: null, maxManWon: null, minWon: null, maxWon: null, sort: "price_asc",
    });
  });
  it("만원 단위를 원으로 바꾼다", () => {
    const f = parseListingFilters({ region: "gangwon", min: "10,000", max: "35000", sort: "price_desc" });
    expect(f).toMatchObject({ region: "gangwon", minWon: 100_000_000, maxWon: 350_000_000, sort: "price_desc" });
  });
  it("잘못된 값은 무시한다", () => {
    expect(parseListingFilters({ region: "mars", min: "-1", max: "abc", sort: "random" })).toMatchObject({
      region: null, minWon: null, maxWon: null, sort: "price_asc",
    });
    expect(parseListingFilters({ min: "0", max: "1.5" })).toMatchObject({ minWon: null, maxWon: null });
  });
  it("최소 > 최대면 바꾼다, 배열 값은 첫 번째", () => {
    expect(parseListingFilters({ min: "50000", max: "10000" })).toMatchObject({ minManWon: 10000, maxManWon: 50000 });
    expect(parseListingFilters({ region: ["jeju", "gangwon"] }).region).toBe("jeju");
  });
});

describe("formatKoreanPrice", () => {
  it("억·만 단위로 읽기 쉽게", () => {
    expect(formatKoreanPrice(318_000_000)).toBe("3억 1,800만 원");
    expect(formatKoreanPrice(100_000_000)).toBe("1억 원");
    expect(formatKoreanPrice(95_000_000)).toBe("9,500만 원");
    expect(formatKoreanPrice(12_000_000_000)).toBe("120억 원");
    expect(formatKoreanPrice(5_000)).toBe("5,000원");
    expect(formatKoreanPrice(null)).toBe("-");
  });
});

describe("deal status helpers", () => {
  it("고객 취소는 inquiry·negotiating만(DB cancel_deal과 동일)", () => {
    expect(customerCanCancel("inquiry")).toBe(true);
    expect(customerCanCancel("negotiating")).toBe(true);
    for (const s of ["contract_scheduled", "contracted", "transferring", "completed", "cancelled"] as const) {
      expect(customerCanCancel(s)).toBe(false);
    }
  });
  it("단계 순서", () => {
    expect(DEAL_STAGES[0]).toBe("inquiry");
    expect(stageIndex("completed")).toBe(5);
    expect(stageIndex("cancelled")).toBe(-1);
  });
});

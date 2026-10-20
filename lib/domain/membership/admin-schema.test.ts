import { describe, expect, it } from "vitest";
import {
  LISTING_STATUS_ADMIN_LABEL,
  MAX_MEMBERSHIP_PRICE,
  parseListingForm,
  parseProductForm,
  parseQuoteForm,
  parseVisibilityForm,
  toFieldErrors,
} from "./admin-schema";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const COURSE = "00000000-0000-4000-a000-000000000001";
const PRODUCT = "00000000-0000-4000-a000-000000000101";
const LISTING = "00000000-0000-4000-a000-000000000201";

describe("parseProductForm", () => {
  const base = { golfCourseId: COURSE, kind: "정회원", name: "구골프 레이크CC 정회원" };

  it("필수값만 있으면 id는 null, 판매 중은 false", () => {
    const r = parseProductForm(form(base));
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: null, golfCourseId: COURSE, kind: "정회원", name: "구골프 레이크CC 정회원", isActive: false });
  });

  it("trim하고 체크박스 on을 true로", () => {
    const r = parseProductForm(form({ ...base, kind: "  주중회원 ", name: " 이름 ", isActive: "on", id: PRODUCT }));
    expect(r.data).toEqual({ id: PRODUCT, golfCourseId: COURSE, kind: "주중회원", name: "이름", isActive: true });
  });

  it("골프장·종류·상품명 필수, 길이 제한", () => {
    const missing = parseProductForm(form({ kind: " ", name: "" }));
    expect(missing.success).toBe(false);
    expect(toFieldErrors(missing.error!.issues)).toEqual({
      golfCourseId: "골프장을 선택해 주세요.", kind: "종류를 입력해 주세요.", name: "상품명을 입력해 주세요.",
    });
    expect(parseProductForm(form({ ...base, kind: "가".repeat(31) })).success).toBe(false);
    expect(parseProductForm(form({ ...base, kind: "가".repeat(30) })).success).toBe(true);
    expect(parseProductForm(form({ ...base, name: "가".repeat(101) })).success).toBe(false);
  });

  it("id·골프장은 uuid만", () => {
    expect(parseProductForm(form({ ...base, id: "1" })).success).toBe(false);
    expect(parseProductForm(form({ ...base, golfCourseId: "x" })).success).toBe(false);
  });
});

describe("parseListingForm", () => {
  const base = { productId: PRODUCT, askingPrice: "180,000,000" };

  it("쉼표를 지운 정수 금액, 빈 설명은 null", () => {
    const r = parseListingForm(form({ ...base, description: "   " }));
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: null, productId: PRODUCT, askingPrice: 180_000_000, description: null });
  });

  it("호가 필수·양수·정수·상한", () => {
    const err = (askingPrice: string) => {
      const r = parseListingForm(form({ ...base, askingPrice }));
      return r.success ? null : toFieldErrors(r.error.issues).askingPrice;
    };
    expect(err("")).toBe("호가를 입력해 주세요.");
    expect(err("abc")).toBe("숫자로 입력해 주세요.");
    expect(err("0")).toBe("호가는 1원 이상으로 입력해 주세요.");
    expect(err("1.5")).toBe("원 단위 정수로 입력해 주세요.");
    expect(err(String(MAX_MEMBERSHIP_PRICE + 1))).toBe("금액을 확인해 주세요.");
    expect(err("1")).toBeNull();
  });

  it("상품 필수, 설명 2000자 이내", () => {
    expect(toFieldErrors(parseListingForm(form({ askingPrice: "1" })).error!.issues).productId).toBe("상품을 선택해 주세요.");
    expect(parseListingForm(form({ ...base, description: "가".repeat(2001) })).success).toBe(false);
    expect(parseListingForm(form({ ...base, description: "가".repeat(2000) })).data?.description).toHaveLength(2000);
  });
});

describe("parseQuoteForm", () => {
  // 2026-10-20 23:30 KST = 14:30 UTC
  const now = new Date("2026-10-20T14:30:00Z");
  const base = { productId: PRODUCT, quotedOn: "2026-10-20" };

  it("한쪽 시세만 있어도 된다(쉼표 허용)", () => {
    expect(parseQuoteForm(form({ ...base, buyPrice: "180,000" }), now).data).toEqual({
      productId: PRODUCT, quotedOn: "2026-10-20", buyPrice: 180000, sellPrice: null,
    });
    expect(parseQuoteForm(form({ ...base, sellPrice: "0" }), now).data?.sellPrice).toBe(0);
  });

  it("둘 다 비면 거부", () => {
    const r = parseQuoteForm(form(base), now);
    expect(r.success).toBe(false);
    expect(toFieldErrors(r.error!.issues).buyPrice).toBe("매수 또는 매도 시세를 입력해 주세요.");
  });

  it("미래 날짜는 KST 기준으로 거부", () => {
    // UTC로는 아직 10-20이지만 KST 10-21 00:30이면 10-21은 오늘
    const lateUtc = new Date("2026-10-20T15:30:00Z");
    expect(parseQuoteForm(form({ ...base, quotedOn: "2026-10-21", buyPrice: "1" }), now).success).toBe(false);
    expect(parseQuoteForm(form({ ...base, quotedOn: "2026-10-21", buyPrice: "1" }), lateUtc).success).toBe(true);
    expect(parseQuoteForm(form({ ...base, quotedOn: "2026-10-01", buyPrice: "1" }), now).success).toBe(true);
  });

  it("날짜 형식·음수·숫자 아님 거부", () => {
    expect(parseQuoteForm(form({ ...base, quotedOn: "2026-02-30", buyPrice: "1" }), now).success).toBe(false);
    expect(parseQuoteForm(form({ ...base, quotedOn: "", buyPrice: "1" }), now).success).toBe(false);
    expect(parseQuoteForm(form({ ...base, buyPrice: "-1" }), now).success).toBe(false);
    expect(parseQuoteForm(form({ ...base, sellPrice: "x" }), now).success).toBe(false);
  });
});

describe("parseVisibilityForm", () => {
  it("visible 문자열을 boolean으로", () => {
    expect(parseVisibilityForm(form({ listingId: LISTING, visible: "true" })).data).toEqual({ listingId: LISTING, visible: true });
    expect(parseVisibilityForm(form({ listingId: LISTING, visible: "false" })).data?.visible).toBe(false);
    expect(parseVisibilityForm(form({ listingId: LISTING, visible: "yes" })).success).toBe(false);
    expect(parseVisibilityForm(form({ listingId: "x", visible: "true" })).success).toBe(false);
  });
});

it("모든 매물 상태에 라벨이 있다", () => {
  expect(LISTING_STATUS_ADMIN_LABEL).toEqual({ hidden: "비공개", listed: "공개", reserved: "상담 중", sold: "판매완료" });
});

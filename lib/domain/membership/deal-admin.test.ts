import { describe, expect, it } from "vitest";
import { advanceBlocker, dealAdminActions, dealTermsSchema, nextDealStatus, parseDealTab } from "./deal-admin";

const ID = "7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

describe("nextDealStatus", () => {
  it("한 칸씩 전진, inquiry·종료 상태는 없음", () => {
    expect(nextDealStatus("inquiry")).toBeNull();
    expect(nextDealStatus("negotiating")).toBe("contract_scheduled");
    expect(nextDealStatus("transferring")).toBe("completed");
    expect(nextDealStatus("completed")).toBeNull();
    expect(nextDealStatus("cancelled")).toBeNull();
  });
});

describe("advanceBlocker", () => {
  it("계약일·합의가 필수(DB와 같은 규칙)", () => {
    expect(advanceBlocker("contract_scheduled", { contract_date: null, agreed_price: null })).toContain("계약일");
    expect(advanceBlocker("contracted", { contract_date: "2026-11-01", agreed_price: null })).toContain("합의가");
    expect(advanceBlocker("contracted", { contract_date: "2026-11-01", agreed_price: 1 })).toBeNull();
  });
});

describe("dealAdminActions", () => {
  it("inquiry는 시작·배정·취소만", () => {
    expect(dealAdminActions("inquiry", { isAssignee: true, isOwner: false })).toEqual({
      canAssign: true, canStart: true, canEditTerms: false, canAdvance: false, canCancel: true,
    });
  });
  it("담당자가 아니면 조건 수정·진행 불가, owner는 가능", () => {
    expect(dealAdminActions("negotiating", { isAssignee: false, isOwner: false }).canAdvance).toBe(false);
    expect(dealAdminActions("negotiating", { isAssignee: false, isOwner: true }).canEditTerms).toBe(true);
  });
  it("종료 상태는 아무것도 못 한다", () => {
    for (const s of ["completed", "cancelled"] as const) {
      expect(Object.values(dealAdminActions(s, { isAssignee: true, isOwner: true })).some(Boolean)).toBe(false);
    }
  });
});

describe("dealTermsSchema", () => {
  it("쉼표 금액, 빈 값은 null", () => {
    expect(dealTermsSchema.parse({ dealId: ID, expectedVersion: "3", agreedPrice: "310,000,000", contractDate: "" }))
      .toEqual({ dealId: ID, expectedVersion: 3, agreedPrice: 310000000, contractDate: null });
  });
  it("0원·잘못된 날짜 거부", () => {
    expect(dealTermsSchema.safeParse({ dealId: ID, expectedVersion: 1, agreedPrice: "0", contractDate: "" }).success).toBe(false);
    expect(dealTermsSchema.safeParse({ dealId: ID, expectedVersion: 1, agreedPrice: "", contractDate: "2026/11/01" }).success).toBe(false);
  });
  it("탭 기본값", () => {
    expect(parseDealTab("x")).toBe("new");
  });
});

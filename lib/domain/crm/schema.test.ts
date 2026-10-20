import { describe, expect, it } from "vitest";
import { activityNoteSchema, escapeLike, parseActivityNoteForm, parseCustomerQuery } from "./schema";

const CUSTOMER = "6f1c3a52-8f3e-4b8a-9c1d-2e5f7a9b0c11";
const BOOKING = "00000000-0000-4000-a000-000000000001";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("activityNoteSchema", () => {
  it("고객 메모는 subjectId 없이 통과하고 본문을 trim한다", () => {
    const r = activityNoteSchema.safeParse({ customerId: CUSTOMER, subjectType: "customer", body: "  통화함  " });
    expect(r.success && r.data).toEqual({ customerId: CUSTOMER, subjectType: "customer", subjectId: undefined, body: "통화함" });
  });

  it("고객 메모에 subjectId가 와도 버린다", () => {
    const r = activityNoteSchema.safeParse({ customerId: CUSTOMER, subjectType: "customer", subjectId: BOOKING, body: "x" });
    expect(r.success && r.data.subjectId).toBeUndefined();
  });

  it("booking/deal 메모는 subjectId가 필요하다", () => {
    for (const subjectType of ["booking", "deal"]) {
      const r = activityNoteSchema.safeParse({ customerId: CUSTOMER, subjectType, body: "x" });
      expect(r.success).toBe(false);
      expect(r.error?.issues.map((i) => i.path.join("."))).toContain("subjectId");
      const ok = activityNoteSchema.safeParse({ customerId: CUSTOMER, subjectType, subjectId: BOOKING, body: "x" });
      expect(ok.success && ok.data.subjectId).toBe(BOOKING);
    }
  });

  it("본문은 1..2000자", () => {
    const base = { customerId: CUSTOMER, subjectType: "customer" };
    expect(activityNoteSchema.safeParse({ ...base, body: "   " }).success).toBe(false);
    expect(activityNoteSchema.safeParse({ ...base, body: "가".repeat(2000) }).success).toBe(true);
    expect(activityNoteSchema.safeParse({ ...base, body: "가".repeat(2001) }).success).toBe(false);
  });

  it("uuid가 아니거나 모르는 subjectType이면 거부한다", () => {
    expect(activityNoteSchema.safeParse({ customerId: "x", subjectType: "customer", body: "a" }).success).toBe(false);
    expect(activityNoteSchema.safeParse({ customerId: CUSTOMER, subjectType: "listing", subjectId: BOOKING, body: "a" }).success).toBe(false);
    expect(activityNoteSchema.safeParse({ customerId: CUSTOMER, subjectType: "booking", subjectId: "1", body: "a" }).success).toBe(false);
  });
});

describe("parseActivityNoteForm", () => {
  it("빈 subjectId는 없는 값으로 본다", () => {
    const r = parseActivityNoteForm(form({ customerId: CUSTOMER, subjectType: "customer", subjectId: "", body: "메모" }));
    expect(r.success).toBe(true);
  });
  it("body가 없으면 실패한다", () => {
    expect(parseActivityNoteForm(form({ customerId: CUSTOMER, subjectType: "customer" })).success).toBe(false);
  });
});

describe("parseCustomerQuery", () => {
  it("빈 값", () => {
    expect(parseCustomerQuery(undefined)).toEqual({ kind: "none" });
    expect(parseCustomerQuery("   ")).toEqual({ kind: "none" });
  });
  it("휴대폰 번호는 하이픈·공백을 지우고 E.164로 바꾼다", () => {
    expect(parseCustomerQuery("010-1234-5678")).toEqual({ kind: "phone", e164: "+821012345678" });
    expect(parseCustomerQuery("010 1234 5678")).toEqual({ kind: "phone", e164: "+821012345678" });
    expect(parseCustomerQuery("+821012345678")).toEqual({ kind: "phone", e164: "+821012345678" });
    expect(parseCustomerQuery(["01012345678", "x"])).toEqual({ kind: "phone", e164: "+821012345678" });
  });
  it("숫자지만 휴대폰 형식이 아니면 invalid_phone", () => {
    expect(parseCustomerQuery("5678")).toEqual({ kind: "invalid_phone" });
    expect(parseCustomerQuery("02-123-4567")).toEqual({ kind: "invalid_phone" });
  });
  it("그 밖에는 이름 부분 일치(와일드카드 이스케이프)", () => {
    expect(parseCustomerQuery(" 홍길동 ")).toEqual({ kind: "name", pattern: "%홍길동%" });
    expect(parseCustomerQuery("50%_off")).toEqual({ kind: "name", pattern: "%50\\%\\_off%" });
  });
  it("escapeLike는 백슬래시도 이스케이프한다", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });
});

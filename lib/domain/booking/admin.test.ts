import { describe, expect, it } from "vitest";
import { adminActions, assignSchema, isoToKstLocal, kstLocalToIso, makeProposeSchema, parseInboxTab, rejectSchema } from "./admin";

const ID = "7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const NOW = new Date("2026-10-20T00:00:00Z"); // KST 09:00

describe("kstLocalToIso", () => {
  it("KST 입력을 +09:00 ISO로", () => {
    expect(kstLocalToIso("2026-10-27T07:30")).toBe("2026-10-27T07:30:00+09:00");
    expect(Date.parse(kstLocalToIso("2026-10-27T07:30")!)).toBe(Date.parse("2026-10-26T22:30:00Z"));
  });
  it("형식 오류·존재하지 않는 날짜는 null", () => {
    expect(kstLocalToIso("2026-10-27 07:30")).toBeNull();
    expect(kstLocalToIso("2026-02-31T07:30")).toBeNull();
    expect(kstLocalToIso("")).toBeNull();
  });
  it("왕복 변환", () => {
    expect(isoToKstLocal("2026-10-26T22:30:00Z")).toBe("2026-10-27T07:30");
  });
});

describe("adminActions", () => {
  it("담당자가 아니면 제안 불가(owner는 가능)", () => {
    expect(adminActions("in_review", { isAssignee: false, isOwner: false }).canPropose).toBe(false);
    expect(adminActions("in_review", { isAssignee: false, isOwner: true }).canPropose).toBe(true);
    expect(adminActions("in_review", { isAssignee: true, isOwner: false }).canPropose).toBe(true);
  });
  it("접수 상태는 배정 먼저(제안 불가)", () => {
    const a = adminActions("requested", { isAssignee: true, isOwner: true });
    expect(a).toMatchObject({ canAssign: true, canPropose: false, canReject: true, canCancel: true });
  });
  it("확정 건은 취소만", () => {
    expect(adminActions("confirmed", { isAssignee: true, isOwner: true })).toEqual({
      canAssign: false, canPropose: false, canReject: false, canCancel: true,
    });
  });
  it("종료 상태는 아무것도 못 한다", () => {
    for (const s of ["rejected", "cancelled"] as const) {
      expect(Object.values(adminActions(s, { isAssignee: true, isOwner: true })).some(Boolean)).toBe(false);
    }
  });
});

describe("makeProposeSchema", () => {
  const schema = makeProposeSchema(NOW);
  it("정상 입력", () => {
    const r = schema.parse({ requestId: ID, expectedVersion: "2", teeTime: "2026-10-27T07:30", greenFeePerPerson: "180,000", validMinutes: "", memo: " " });
    expect(r).toEqual({ requestId: ID, expectedVersion: 2, teeTime: "2026-10-27T07:30:00+09:00", greenFeePerPerson: 180000, validMinutes: 120, memo: undefined });
  });
  it("과거 티타임 거부(KST 기준)", () => {
    const r = schema.safeParse({ requestId: ID, expectedVersion: 1, teeTime: "2026-10-20T08:59", greenFeePerPerson: 1 });
    expect(r.success).toBe(false);
  });
  it("그린피 필수·음수 거부, 유효시간 범위", () => {
    expect(schema.safeParse({ requestId: ID, expectedVersion: 1, teeTime: "2026-10-27T07:30", greenFeePerPerson: "" }).success).toBe(false);
    expect(schema.safeParse({ requestId: ID, expectedVersion: 1, teeTime: "2026-10-27T07:30", greenFeePerPerson: "-1" }).success).toBe(false);
    expect(schema.safeParse({ requestId: ID, expectedVersion: 1, teeTime: "2026-10-27T07:30", greenFeePerPerson: "1", validMinutes: "20" }).success).toBe(false);
  });
});

describe("기타 스키마", () => {
  it("거절 사유 필수", () => {
    expect(rejectSchema.safeParse({ requestId: ID, expectedVersion: 1, reason: "  " }).success).toBe(false);
    expect(rejectSchema.parse({ requestId: ID, expectedVersion: "3", reason: " 만석 " }).reason).toBe("만석");
  });
  it("배정 대상 uuid", () => {
    expect(assignSchema.safeParse({ requestId: ID, assigneeId: "x", expectedVersion: 1 }).success).toBe(false);
  });
  it("인박스 탭 기본값", () => {
    expect(parseInboxTab(undefined)).toBe("new");
    expect(parseInboxTab("sla")).toBe("sla");
    expect(parseInboxTab("evil")).toBe("new");
  });
});

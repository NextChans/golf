import { describe, expect, it } from "vitest";
import {
  acceptProposalSchema, addDaysIso, cancelBookingSchema, declineProposalSchema,
  makeBookingRequestSchema, MAX_ADVANCE_DAYS, parseBookingForm, todayKst,
} from "./schema";

// UTC 15:30 = KST 다음날 00:30
const NOW = new Date("2026-10-20T15:30:00Z");
const KEY = "6f1c3a52-8f3e-4b8a-9c1d-2e5f7a9b0c11";
const COURSE = "00000000-0000-4000-a000-000000000001";

const base = {
  idempotencyKey: KEY, golfCourseId: COURSE, courseNameFree: null, playDate: "2026-10-25",
  timePref: "part_1", timeFrom: null, timeTo: null, players: 4, budgetPerPerson: null, note: null,
};
const schema = makeBookingRequestSchema(NOW);
const parse = (patch: Record<string, unknown>) => schema.safeParse({ ...base, ...patch });
const paths = (r: ReturnType<typeof parse>) => (r.success ? [] : r.error.issues.map((i) => i.path.join(".")));

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("todayKst / addDaysIso", () => {
  it("KST 자정 넘김을 반영한다", () => {
    expect(todayKst(NOW)).toBe("2026-10-21");
    expect(todayKst(new Date("2026-10-20T14:59:59Z"))).toBe("2026-10-20");
    expect(todayKst(new Date("2026-10-20T15:00:00Z"))).toBe("2026-10-21");
  });
  it("달·연·윤년 경계", () => {
    expect(addDaysIso("2026-10-21", MAX_ADVANCE_DAYS)).toBe("2027-04-19");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("bookingRequestSchema: 날짜", () => {
  it("오늘(KST)은 허용, 어제는 거부", () => {
    expect(parse({ playDate: "2026-10-21" }).success).toBe(true);
    // UTC 기준으로는 오늘이지만 KST로는 어제
    expect(paths(parse({ playDate: "2026-10-20" }))).toEqual(["playDate"]);
  });
  it("+180일 허용, +181일 거부", () => {
    expect(parse({ playDate: "2027-04-19" }).success).toBe(true);
    expect(paths(parse({ playDate: "2027-04-20" }))).toEqual(["playDate"]);
  });
  it("형식·존재하지 않는 날짜 거부", () => {
    expect(parse({ playDate: "2026/10/25" }).success).toBe(false);
    expect(parse({ playDate: "2026-11-31" }).success).toBe(false);
    expect(parse({ playDate: null }).success).toBe(false);
  });
});

describe("bookingRequestSchema: 골프장", () => {
  it("선택 또는 자유 입력 중 하나", () => {
    expect(parse({}).success).toBe(true);
    const free = parse({ golfCourseId: null, courseNameFree: "  동네CC  " });
    expect(free.success && free.data.courseNameFree).toBe("동네CC");
  });
  it("둘 다 / 둘 다 없음은 거부", () => {
    const both = parse({ courseNameFree: "동네CC" });
    expect(paths(both)).toEqual(["golfCourseId"]);
    expect(!both.success && both.error.issues[0]?.message).toBe("골프장을 선택하거나 직접 입력해 주세요.");
    expect(paths(parse({ golfCourseId: null }))).toEqual(["golfCourseId"]);
    expect(paths(parse({ golfCourseId: "", courseNameFree: "   " }))).toEqual(["golfCourseId"]);
  });
  it("uuid 아님·100자 초과 거부", () => {
    expect(parse({ golfCourseId: "abc" }).success).toBe(false);
    expect(parse({ golfCourseId: null, courseNameFree: "가".repeat(101) }).success).toBe(false);
    expect(parse({ golfCourseId: null, courseNameFree: "가".repeat(100) }).success).toBe(true);
  });
});

describe("bookingRequestSchema: 시간", () => {
  const range = (timeFrom: unknown, timeTo: unknown) => parse({ timePref: "range", timeFrom, timeTo });
  it("범위 지정 정상", () => {
    const r = range("07:00", "09:30");
    expect(r.success && [r.data.timeFrom, r.data.timeTo]).toEqual(["07:00", "09:30"]);
    expect(range("05:00", "18:00").success).toBe(true);
    const sec = range("07:00:00", "09:30:00");
    expect(sec.success && sec.data.timeFrom).toBe("07:00");
  });
  it("30분 단위가 아니면 거부", () => {
    expect(paths(range("07:15", "09:00"))).toEqual(["timeFrom"]);
    expect(paths(range("07:00", "09:45"))).toEqual(["timeTo"]);
  });
  it("시작 >= 종료 거부", () => {
    expect(paths(range("09:00", "09:00"))).toEqual(["timeTo"]);
    expect(paths(range("10:00", "09:00"))).toEqual(["timeTo"]);
  });
  it("05:00~18:00 밖은 거부", () => {
    expect(paths(range("04:30", "09:00"))).toEqual(["timeFrom"]);
    expect(paths(range("17:00", "18:30"))).toEqual(["timeTo"]);
  });
  it("range인데 시간이 없으면 거부", () => {
    expect(paths(range(null, null))).toEqual(["timeFrom", "timeTo"]);
    expect(paths(range("07:00", ""))).toEqual(["timeTo"]);
  });
  it("1부·2부에 시간을 넣으면 거부", () => {
    expect(paths(parse({ timePref: "part_1", timeFrom: "07:00", timeTo: null }))).toEqual(["timeFrom"]);
    expect(parse({ timePref: "part_2", timeFrom: null, timeTo: "12:00" }).success).toBe(false);
    expect(parse({ timePref: "part_2" }).success).toBe(true);
  });
  it("알 수 없는 timePref·형식 거부", () => {
    expect(paths(parse({ timePref: "night" }))).toEqual(["timePref"]);
    expect(parse({ timePref: "range", timeFrom: "7:00", timeTo: "09:00" }).success).toBe(false);
  });
});

describe("bookingRequestSchema: 인원·예산·메모", () => {
  it("인원 1~4", () => {
    expect(parse({ players: 1 }).success).toBe(true);
    expect(paths(parse({ players: 0 }))).toEqual(["players"]);
    expect(paths(parse({ players: 5 }))).toEqual(["players"]);
    expect(parse({ players: 2.5 }).success).toBe(false);
    expect(parse({ players: null }).success).toBe(false);
  });
  it("예산 0~1,000만, 정수", () => {
    expect(parse({ budgetPerPerson: 0 }).success).toBe(true);
    expect(parse({ budgetPerPerson: 10_000_000 }).success).toBe(true);
    expect(paths(parse({ budgetPerPerson: 10_000_001 }))).toEqual(["budgetPerPerson"]);
    expect(parse({ budgetPerPerson: -1 }).success).toBe(false);
    expect(parse({ budgetPerPerson: "abc" }).success).toBe(false);
  });
  it("메모 trim, 1000자 제한", () => {
    const r = parse({ note: "  카트 필요  " });
    expect(r.success && r.data.note).toBe("카트 필요");
    expect(parse({ note: "가".repeat(1000) }).success).toBe(true);
    expect(paths(parse({ note: "가".repeat(1001) }))).toEqual(["note"]);
  });
  it("멱등키는 uuid", () => {
    expect(paths(parse({ idempotencyKey: "x" }))).toEqual(["idempotencyKey"]);
  });
});

describe("parseBookingForm", () => {
  const full = {
    idempotencyKey: KEY, golfCourseId: "", courseNameFree: "동네CC", playDate: "2026-10-21", timePref: "range",
    timeFrom: "06:30", timeTo: "08:00", players: "3", budgetPerPerson: "200,000", note: "",
  };
  it("문자열을 변환하고 빈 값은 null", () => {
    const r = parseBookingForm(form(full), NOW);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      idempotencyKey: KEY, golfCourseId: null, courseNameFree: "동네CC", playDate: "2026-10-21", timePref: "range",
      timeFrom: "06:30", timeTo: "08:00", players: 3, budgetPerPerson: 200_000, note: null,
    });
  });
  it("빠진 필드·빈 예산은 null", () => {
    const fd = form({ ...full, budgetPerPerson: "", timePref: "part_1", timeFrom: "", timeTo: "" });
    fd.delete("note");
    const r = parseBookingForm(fd, NOW);
    expect(r.success && [r.data.budgetPerPerson, r.data.note, r.data.timeFrom]).toEqual([null, null, null]);
  });
  it("주입한 now로 날짜를 판단한다", () => {
    expect(parseBookingForm(form({ ...full, playDate: "2026-10-20" }), NOW).success).toBe(false);
    expect(parseBookingForm(form({ ...full, playDate: "2026-10-20" }), new Date("2026-10-20T03:00:00Z")).success).toBe(true);
  });
  it("인원이 숫자가 아니면 거부", () => {
    const r = parseBookingForm(form({ ...full, players: "많이" }), NOW);
    expect(paths(r)).toEqual(["players"]);
  });
});

describe("제안·취소 스키마", () => {
  const P = "11111111-1111-4111-8111-111111111111";
  it("accept", () => {
    expect(acceptProposalSchema.safeParse({ idempotencyKey: KEY, proposalId: P, expectedVersion: 3 }).success).toBe(true);
    expect(acceptProposalSchema.safeParse({ idempotencyKey: KEY, proposalId: P, expectedVersion: 0 }).success).toBe(false);
    expect(acceptProposalSchema.safeParse({ idempotencyKey: "x", proposalId: P, expectedVersion: 1 }).success).toBe(false);
  });
  it("decline 사유: trim, 빈 값 null, 500자", () => {
    const r = declineProposalSchema.safeParse({ proposalId: P, expectedVersion: "2", reason: "  " });
    expect(r.success && r.data).toEqual({ proposalId: P, expectedVersion: 2, reason: null });
    const t = declineProposalSchema.safeParse({ proposalId: P, expectedVersion: 2, reason: " 시간 안 맞음 " });
    expect(t.success && t.data.reason).toBe("시간 안 맞음");
    expect(declineProposalSchema.safeParse({ proposalId: P, expectedVersion: 2, reason: "가".repeat(501) }).success).toBe(false);
  });
  it("cancel", () => {
    expect(cancelBookingSchema.safeParse({ requestId: P, expectedVersion: 1, reason: null }).success).toBe(true);
    expect(cancelBookingSchema.safeParse({ requestId: P, expectedVersion: 1.5, reason: null }).success).toBe(false);
    expect(cancelBookingSchema.safeParse({ requestId: "nope", expectedVersion: 1, reason: null }).success).toBe(false);
  });
});

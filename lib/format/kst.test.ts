import { describe, expect, it } from "vitest";
import { formatKst, formatKstDate, isoToKstLocal, kstLocalToIso, todayKst } from "./kst";

describe("KST 표시", () => {
  it("UTC 시각을 KST로 표시한다", () => {
    expect(formatKst("2026-10-20T15:30:00Z")).toContain("10. 21.");
    expect(formatKst("2026-10-20T15:30:00Z")).toContain("00:30");
  });
  it("date 값은 날짜가 밀리지 않는다", () => {
    expect(formatKstDate("2026-10-24")).toContain("10. 24.");
    expect(formatKstDate("2026-10-24")).toContain("토");
  });
  it("빈 값은 -", () => {
    expect(formatKst(null)).toBe("-");
    expect(formatKstDate("")).toBe("-");
  });
});

describe("todayKst", () => {
  it("KST 자정 넘김을 반영한다", () => {
    expect(todayKst(new Date("2026-10-20T15:00:00Z"))).toBe("2026-10-21");
    expect(todayKst(new Date("2026-10-20T14:59:59Z"))).toBe("2026-10-20");
  });
});

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

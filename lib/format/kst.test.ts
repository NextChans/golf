import { describe, expect, it } from "vitest";
import { formatKst, formatKstDate } from "./kst";

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

import { describe, expect, it } from "vitest";
import { formatWon } from "./money";

describe("formatWon", () => {
  it("천 단위 쉼표 + 원", () => {
    expect(formatWon(200_000)).toBe("200,000원");
    expect(formatWon(0)).toBe("0원");
    expect(formatWon(10_000_000)).toBe("10,000,000원");
  });
  it("값 없음은 -", () => {
    expect(formatWon(null)).toBe("-");
    expect(formatWon(undefined)).toBe("-");
  });
});

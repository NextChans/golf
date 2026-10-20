import { describe, expect, it } from "vitest";
import { formatWon, totalGreenFee } from "./money";

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

describe("totalGreenFee", () => {
  it("1인 그린피 × 인원", () => {
    expect(totalGreenFee(180_000, 4)).toBe(720_000);
    expect(totalGreenFee(0, 3)).toBe(0);
  });
});

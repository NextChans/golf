import { describe, expect, it } from "vitest";
import { formatPhone, krMobileSchema, maskPhone } from "./phone";

describe("krMobileSchema", () => {
  it("하이픈·공백을 지우고 E.164로 바꾼다", () => {
    expect(krMobileSchema.parse("010-1234-5678")).toBe("+821012345678");
    expect(krMobileSchema.parse("010 0000 0001")).toBe("+821000000001");
  });
  it("휴대폰 번호가 아니면 거부", () => {
    expect(krMobileSchema.safeParse("02-123-4567").success).toBe(false);
    expect(krMobileSchema.safeParse("+821012345678").success).toBe(false);
    expect(krMobileSchema.safeParse("0101234").success).toBe(false);
  });
});

describe("maskPhone / formatPhone", () => {
  it("목록 마스킹", () => {
    expect(maskPhone("+821012345678")).toBe("010-****-5678");
    expect(maskPhone(null)).toBe("-");
  });
  it("상세 표시", () => {
    expect(formatPhone("+821012345678")).toBe("010-1234-5678");
  });
});

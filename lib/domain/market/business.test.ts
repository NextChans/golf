import { describe, expect, it } from "vitest";
import { formatBusinessNumber, isValidBusinessNumber, validateBusiness } from "./business";

describe("사업자등록번호", () => {
  it("검증번호가 맞으면 통과(하이픈 무시)", () => {
    expect(isValidBusinessNumber("220-81-62517")).toBe(true);
    expect(isValidBusinessNumber("1248100998")).toBe(true);
  });
  it("검증번호가 틀리거나 자릿수가 다르면 실패", () => {
    expect(isValidBusinessNumber("220-81-62518")).toBe(false);
    expect(isValidBusinessNumber("123456789")).toBe(false);
    expect(isValidBusinessNumber("0000000000")).toBe(false);
  });
  it("입력 중 하이픈 표시", () => {
    expect(formatBusinessNumber("22")).toBe("22");
    expect(formatBusinessNumber("2208")).toBe("220-8");
    expect(formatBusinessNumber("220816251799")).toBe("220-81-62517");
  });
  it("폼 검증 메시지", () => {
    expect(validateBusiness({ name: " ", number: "123" })).toEqual({
      name: "사업자명을 입력해 주세요.", number: "사업자등록번호 10자리를 입력해 주세요.",
    });
    expect(validateBusiness({ name: "구골프", number: "220-81-62518" })).toEqual({ number: "사업자등록번호를 다시 확인해 주세요." });
    expect(validateBusiness({ name: "구골프", number: "2208162517" })).toEqual({});
  });
});

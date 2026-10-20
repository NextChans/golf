import { describe, expect, it } from "vitest";
import { toAppError } from "./errors";

describe("toAppError", () => {
  it("GB 코드 + 알려진 message는 해당 코드로", () => {
    expect(toAppError({ code: "GB409", message: "version_conflict" }).code).toBe("version_conflict");
    expect(toAppError({ code: "GB429", message: "rate_limited" }).code).toBe("rate_limited");
  });
  it("권한 거부(42501)는 forbidden", () => {
    expect(toAppError({ code: "42501", message: "permission denied for table x" }).code).toBe("forbidden");
  });
  it("알 수 없는 에러는 unknown, 내부 메시지를 노출하지 않는다", () => {
    const e = toAppError({ code: "23505", message: "duplicate key value violates unique constraint secret_idx" });
    expect(e.code).toBe("unknown");
    expect(e.message).not.toContain("secret_idx");
  });
  it("GB 코드인데 모르는 message는 SQLSTATE 계열로 대체한다(D-49)", () => {
    expect(toAppError({ code: "GB409", message: "something_else" }).code).toBe("invalid_state");
    expect(toAppError({ code: "GB422", message: "new_code" }).code).toBe("invalid_input");
    expect(toAppError({ code: "GB403", message: "new_code" }).code).toBe("forbidden");
  });
  it("모르는 GB 계열은 unknown", () => {
    expect(toAppError({ code: "GB500", message: "something_else" }).code).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import { fieldErrors } from "./form";

describe("fieldErrors", () => {
  it("필드별 첫 메시지만 남기고, 경로가 없으면 form", () => {
    expect(
      fieldErrors([
        { path: ["price"], message: "첫 메시지" },
        { path: ["price"], message: "두 번째" },
        { path: [], message: "전체" },
      ]),
    ).toEqual({ price: "첫 메시지", form: "전체" });
  });
});

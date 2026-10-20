import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("커스텀 글자 크기 토큰과 글자 색을 함께 유지한다", () => {
    expect(cn("text-primary-foreground", "text-body")).toBe("text-primary-foreground text-body");
  });
  it("같은 그룹 충돌은 뒤의 값을 쓴다", () => {
    expect(cn("text-body", "text-micro")).toBe("text-micro");
    expect(cn("text-foreground", "text-primary")).toBe("text-primary");
  });
});

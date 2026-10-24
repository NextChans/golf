import { describe, expect, it } from "vitest";
import { pushRecent } from "./recent";

describe("pushRecent", () => {
  it("맨 앞에 넣는다", () => expect(pushRecent(["a", "b"], "c")).toEqual(["c", "a", "b"]));
  it("중복은 제거하고 맨 앞으로 옮긴다", () => expect(pushRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]));
  it("상한을 넘으면 오래된 것부터 버린다", () => {
    const list = Array.from({ length: 10 }, (_, i) => `i${i}`);
    const out = pushRecent(list, "new");
    expect(out).toHaveLength(10);
    expect(out[0]).toBe("new");
    expect(out).not.toContain("i9");
  });
  it("max를 지정할 수 있고 원본을 바꾸지 않는다", () => {
    const list = ["a", "b", "c"];
    expect(pushRecent(list, "d", 2)).toEqual(["d", "a"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
  it("빈 목록에서 시작한다", () => expect(pushRecent([], "a")).toEqual(["a"]));
});

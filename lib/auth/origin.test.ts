import { describe, expect, it } from "vitest";
import { pickOrigin } from "./origin";

const base = { siteUrl: "https://golf-lac-delta.vercel.app", requestProto: "https" };
const vercelUrls = ["golf-mgsrcc0e8-babadung-6380s-projects.vercel.app", "golf-git-claude-x-babadung-6380s-projects.vercel.app"];

describe("pickOrigin", () => {
  it("운영 도메인 요청은 운영 도메인으로", () => {
    expect(pickOrigin({ ...base, requestHost: "golf-lac-delta.vercel.app", vercelUrls })).toBe("https://golf-lac-delta.vercel.app");
  });
  it("이 배포의 preview 도메인 요청은 같은 preview 도메인으로", () => {
    expect(pickOrigin({ ...base, requestHost: "golf-mgsrcc0e8-babadung-6380s-projects.vercel.app", vercelUrls }))
      .toBe("https://golf-mgsrcc0e8-babadung-6380s-projects.vercel.app");
  });
  it("허용되지 않은 호스트(위조)는 운영 도메인으로 대체", () => {
    expect(pickOrigin({ ...base, requestHost: "evil.example", vercelUrls })).toBe("https://golf-lac-delta.vercel.app");
    expect(pickOrigin({ ...base, requestHost: "golf-other-babadung-6380s-projects.vercel.app", vercelUrls })).toBe("https://golf-lac-delta.vercel.app");
  });
  it("로컬은 http 유지", () => {
    expect(pickOrigin({ ...base, requestProto: "http", requestHost: "localhost:3000", vercelUrls: [] })).toBe("http://localhost:3000");
  });
  it("호스트가 없으면 운영 도메인", () => {
    expect(pickOrigin({ ...base, requestHost: null, vercelUrls })).toBe("https://golf-lac-delta.vercel.app");
  });
});

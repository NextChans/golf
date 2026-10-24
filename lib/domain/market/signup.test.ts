import { describe, expect, it } from "vitest";
import { pickDefaultName, welcomeLinks } from "./signup";

describe("pickDefaultName", () => {
  it("name → full_name → nickname 순서로 첫 값을 고른다", () => {
    expect(pickDefaultName({ name: "홍길동", full_name: "길동", nickname: "gd" })).toBe("홍길동");
    expect(pickDefaultName({ name: "  ", full_name: "김철수", nickname: "cs" })).toBe("김철수");
    expect(pickDefaultName({ nickname: "골프왕" })).toBe("골프왕");
  });
  it("문자열이 아니거나 비어 있으면 건너뛰고, 없으면 빈 문자열", () => {
    expect(pickDefaultName({ name: 123, nickname: "닉" })).toBe("닉");
    expect(pickDefaultName({})).toBe("");
    expect(pickDefaultName(null)).toBe("");
    expect(pickDefaultName("홍길동")).toBe("");
  });
  it("공백을 정리하고 50자로 자른다", () => {
    expect(pickDefaultName({ name: "  홍   길동 " })).toBe("홍 길동");
    expect(pickDefaultName({ name: "가".repeat(60) })).toHaveLength(50);
  });
});

describe("welcomeLinks", () => {
  it("회원권 앱에서 왔으면 그 화면으로, 내 정보는 앱 마이페이지", () => {
    expect(welcomeLinks("/market/mypage")).toEqual({ browse: "/market/mypage", profile: "/market/mypage", resume: null });
    expect(welcomeLinks("/market")).toEqual({ browse: "/market", profile: "/market/mypage", resume: null });
    expect(welcomeLinks("/")).toEqual({ browse: "/", profile: "/market/mypage", resume: null });
    expect(welcomeLinks("/?tab=sell")).toEqual({ browse: "/?tab=sell", profile: "/market/mypage", resume: null });
  });
  it("기본(/me)이면 회원권 홈(/)과 /me", () => {
    expect(welcomeLinks("/me")).toEqual({ browse: "/", profile: "/me", resume: null });
  });
  it("다른 화면에서 왔으면 이어서 하기 경로를 남긴다", () => {
    expect(welcomeLinks("/groups/new")).toEqual({ browse: "/", profile: "/me", resume: "/groups/new" });
    expect(welcomeLinks("/marketing")).toEqual({ browse: "/", profile: "/me", resume: "/marketing" });
  });
});

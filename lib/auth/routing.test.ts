import { describe, expect, it } from "vitest";
import type { Session } from "./claims";
import { afterLoginPath, decideRoute, loginErrorPath, safeNext } from "./routing";

const customer = (over: Partial<Session> = {}): Session => ({
  userId: "c", role: "customer", aal: "aal1", isKakao: true, onboarded: true, passwordChangeRequired: false, ...over,
});
const admin = (over: Partial<Session> = {}): Session => ({
  userId: "a", role: "admin", aal: "aal2", isKakao: false, onboarded: false, passwordChangeRequired: false, ...over,
});

describe("decideRoute: /admin", () => {
  it("미인증 → /admin/login?next=", () => {
    expect(decideRoute("/admin/staff", null)).toEqual({ type: "redirect", to: "/admin/login?next=%2Fadmin%2Fstaff" });
  });
  it("고객 → 403", () => {
    expect(decideRoute("/admin", customer())).toEqual({ type: "forbidden" });
    expect(decideRoute("/admin/mfa", customer())).toEqual({ type: "forbidden" });
  });
  it("/admin/login은 미인증·고객 모두 열린다", () => {
    expect(decideRoute("/admin/login", null)).toEqual({ type: "next" });
    expect(decideRoute("/admin/login", customer())).toEqual({ type: "next" });
  });
  it("로그인한 운영자가 /admin/login에 오면 /admin", () => {
    expect(decideRoute("/admin/login", admin())).toEqual({ type: "redirect", to: "/admin" });
  });
  it("임시 비밀번호 상태면 어디로 가든 /admin/password", () => {
    const s = admin({ aal: "aal1", passwordChangeRequired: true });
    expect(decideRoute("/admin", s)).toEqual({ type: "redirect", to: "/admin/password" });
    expect(decideRoute("/admin/mfa", s)).toEqual({ type: "redirect", to: "/admin/password" });
    expect(decideRoute("/admin/password", s)).toEqual({ type: "next" });
  });
  it("aal1 운영자 → /admin/mfa", () => {
    const s = admin({ aal: "aal1" });
    expect(decideRoute("/admin", s)).toEqual({ type: "redirect", to: "/admin/mfa" });
    expect(decideRoute("/admin/staff", s)).toEqual({ type: "redirect", to: "/admin/mfa" });
    expect(decideRoute("/admin/mfa", s)).toEqual({ type: "next" });
  });
  it("aal2 운영자는 통과, MFA·비밀번호 화면은 /admin으로", () => {
    expect(decideRoute("/admin/staff", admin())).toEqual({ type: "next" });
    expect(decideRoute("/admin/mfa", admin())).toEqual({ type: "redirect", to: "/admin" });
    expect(decideRoute("/admin/password", admin())).toEqual({ type: "redirect", to: "/admin" });
  });
  it("/administrator 같은 경로는 /admin으로 취급하지 않는다", () => {
    expect(decideRoute("/administrator", null)).toEqual({ type: "next" });
  });
});

describe("decideRoute: 고객 경로", () => {
  it("미인증 → /login?next=", () => {
    expect(decideRoute("/bookings/1", null)).toEqual({ type: "redirect", to: "/login?next=%2Fbookings%2F1" });
  });
  it("온보딩 전 → /onboarding?next=", () => {
    expect(decideRoute("/me", customer({ onboarded: false }))).toEqual({ type: "redirect", to: "/onboarding?next=%2Fme" });
    expect(decideRoute("/onboarding", customer({ onboarded: false }))).toEqual({ type: "next" });
  });
  it("온보딩 후 /onboarding → /me", () => {
    expect(decideRoute("/onboarding", customer())).toEqual({ type: "redirect", to: "/me" });
  });
  it("운영자가 고객 경로에 오면 /admin", () => {
    expect(decideRoute("/me", admin())).toEqual({ type: "redirect", to: "/admin" });
  });
  it("/login: 로그인 상태면 목적지로", () => {
    expect(decideRoute("/login", customer())).toEqual({ type: "redirect", to: "/me" });
    expect(decideRoute("/login", customer({ onboarded: false }))).toEqual({ type: "redirect", to: "/onboarding" });
    expect(decideRoute("/login", admin())).toEqual({ type: "redirect", to: "/admin" });
  });
  it("회원권: 목록·상세는 공개, 매도 상담·내 거래는 로그인 필요", () => {
    expect(decideRoute("/memberships", null)).toEqual({ type: "next" });
    expect(decideRoute("/memberships/00000000-0000-4000-c000-000000000001", null)).toEqual({ type: "next" });
    expect(decideRoute("/memberships/sell", null)).toEqual({ type: "redirect", to: "/login?next=%2Fmemberships%2Fsell" });
    expect(decideRoute("/memberships/sell", customer())).toEqual({ type: "next" });
    expect(decideRoute("/memberships/sell", customer({ onboarded: false }))).toEqual({
      type: "redirect", to: "/onboarding?next=%2Fmemberships%2Fsell",
    });
    expect(decideRoute("/memberships/sell", admin())).toEqual({ type: "redirect", to: "/admin" });
    expect(decideRoute("/memberships/seller", null)).toEqual({ type: "next" });
    expect(decideRoute("/deals/1", null)).toEqual({ type: "redirect", to: "/login?next=%2Fdeals%2F1" });
  });
  it("모임: 목록·상세는 공개, 만들기·수정·정모 개설은 로그인 필요", () => {
    const id = "00000000-0000-4000-d000-000000000001";
    expect(decideRoute("/groups", null)).toEqual({ type: "next" });
    expect(decideRoute(`/groups/${id}`, null)).toEqual({ type: "next" });
    expect(decideRoute("/groups/new", null)).toEqual({ type: "redirect", to: "/login?next=%2Fgroups%2Fnew" });
    expect(decideRoute("/groups/new", customer())).toEqual({ type: "next" });
    expect(decideRoute("/groups/new", customer({ onboarded: false }))).toEqual({
      type: "redirect", to: "/onboarding?next=%2Fgroups%2Fnew",
    });
    expect(decideRoute(`/groups/${id}/edit`, null)).toEqual({ type: "redirect", to: `/login?next=${encodeURIComponent(`/groups/${id}/edit`)}` });
    expect(decideRoute(`/groups/${id}/meetings/new`, null)).toEqual({
      type: "redirect", to: `/login?next=${encodeURIComponent(`/groups/${id}/meetings/new`)}`,
    });
    expect(decideRoute(`/groups/${id}/meetings/new`, admin())).toEqual({ type: "redirect", to: "/admin" });
    expect(decideRoute(`/groups/${id}/editor`, null)).toEqual({ type: "next" });
    expect(decideRoute("/groups/newest", null)).toEqual({ type: "next" });
  });
  it("공개 경로는 통과", () => {
    expect(decideRoute("/", null)).toEqual({ type: "next" });
    expect(decideRoute("/auth/callback", null)).toEqual({ type: "next" });
  });
});

describe("safeNext", () => {
  it("내부 경로만 허용한다", () => {
    expect(safeNext("/bookings", "/me")).toBe("/bookings");
    expect(safeNext("https://evil.example", "/me")).toBe("/me");
    expect(safeNext("//evil.example", "/me")).toBe("/me");
    expect(safeNext("/\\evil.example", "/me")).toBe("/me");
    expect(safeNext(null, "/me")).toBe("/me");
  });
});

describe("afterLoginPath·loginErrorPath(D-81)", () => {
  it("온보딩 전 고객은 공개 경로로 돌아가더라도 가입 마무리부터", () => {
    expect(afterLoginPath("/market/mypage", customer({ onboarded: false }))).toBe("/onboarding?next=%2Fmarket%2Fmypage");
    expect(afterLoginPath("/onboarding", customer({ onboarded: false }))).toBe("/onboarding");
  });
  it("온보딩 고객은 그대로, 운영자는 /admin", () => {
    expect(afterLoginPath("/market/my", customer())).toBe("/market/my");
    expect(afterLoginPath("/market/my", admin())).toBe("/admin");
    expect(afterLoginPath("/me", null)).toBe("/me");
  });
  it("실패 화면은 시작한 화면 계열로", () => {
    expect(loginErrorPath("/market/my", "취소")).toBe("/market/login?error=%EC%B7%A8%EC%86%8C&next=%2Fmarket%2Fmy");
    expect(loginErrorPath("/me", "취소")).toBe("/login?error=%EC%B7%A8%EC%86%8C");
  });
});

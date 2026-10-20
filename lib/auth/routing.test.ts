import { describe, expect, it } from "vitest";
import type { Session } from "./claims";
import { decideRoute, safeNext } from "./routing";

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

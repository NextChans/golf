import type { Session } from "./claims";

/**
 * 경로 접근 판단(middleware에서 사용, 서버 컴포넌트 가드와 같은 규칙).
 * 순수 함수로 두어 단위 테스트로 모든 분기를 검증한다(lib/auth/routing.test.ts).
 */
export type RouteDecision =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "forbidden" };

const ADMIN_LOGIN = "/admin/login";
const ADMIN_MFA = "/admin/mfa";
const ADMIN_PASSWORD = "/admin/password";
// /memberships는 공개(D-16)지만 매도 상담 신청(/memberships/sell)은 로그인 고객 전용
const CUSTOMER_PROTECTED = ["/me", "/onboarding", "/deals", "/memberships/sell", "/groups/new"];
// /groups·/groups/<id>는 공개(활성 모임 탐색)지만 모임 관리 화면(수정·정모 개설)은 로그인 고객 전용
const CUSTOMER_PROTECTED_PATTERNS = [/^\/groups\/[^/]+\/(edit|meetings)(\/|$)/];

const startsWithSegment = (path: string, base: string) => path === base || path.startsWith(base + "/");

/** 로그인 후 돌아갈 경로. 외부 URL·프로토콜 상대 경로는 허용하지 않는다(오픈 리다이렉트 방지). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

const withNext = (to: string, path: string) => `${to}?next=${encodeURIComponent(path)}`;

export function decideRoute(path: string, session: Session | null): RouteDecision {
  const staff = session?.role === "admin" || session?.role === "owner";

  if (startsWithSegment(path, "/admin")) {
    if (path === ADMIN_LOGIN) {
      return staff ? { type: "redirect", to: "/admin" } : { type: "next" };
    }
    if (!session) return { type: "redirect", to: withNext(ADMIN_LOGIN, path) };
    if (!staff) return { type: "forbidden" };
    if (session.passwordChangeRequired) {
      return path === ADMIN_PASSWORD ? { type: "next" } : { type: "redirect", to: ADMIN_PASSWORD };
    }
    if (session.aal !== "aal2") {
      return path === ADMIN_MFA ? { type: "next" } : { type: "redirect", to: ADMIN_MFA };
    }
    if (path === ADMIN_MFA || path === ADMIN_PASSWORD) return { type: "redirect", to: "/admin" };
    return { type: "next" };
  }

  if (path === "/login") {
    if (!session) return { type: "next" };
    if (staff) return { type: "redirect", to: "/admin" };
    return { type: "redirect", to: session.onboarded ? "/me" : "/onboarding" };
  }

  if (
    CUSTOMER_PROTECTED.some((base) => startsWithSegment(path, base)) ||
    CUSTOMER_PROTECTED_PATTERNS.some((re) => re.test(path))
  ) {
    if (!session) return { type: "redirect", to: withNext("/login", path) };
    if (staff) return { type: "redirect", to: "/admin" };
    if (!session.onboarded) {
      return startsWithSegment(path, "/onboarding") ? { type: "next" } : { type: "redirect", to: withNext("/onboarding", path) };
    }
    if (startsWithSegment(path, "/onboarding")) return { type: "redirect", to: "/me" };
  }

  return { type: "next" };
}

/**
 * 카카오 로그인 직후 갈 곳. 공개 경로(/market 등)로 돌아가더라도 온보딩 전 고객은 가입 마무리부터(D-81).
 * 운영자는 고객 로그인을 쓰지 않지만 혹시 오면 /admin. 로그인 실패 화면은 시작한 화면 계열로.
 */
export function afterLoginPath(next: string, session: Session | null): string {
  if (!session) return next;
  if (session.role === "admin" || session.role === "owner") return "/admin";
  if (!session.onboarded && !startsWithSegment(next, "/onboarding")) return withNext("/onboarding", next);
  return next;
}

export function loginErrorPath(next: string, reason: string): string {
  const base = startsWithSegment(next, "/market") ? "/market/login" : "/login";
  return `${base}?error=${encodeURIComponent(reason.slice(0, 200))}${base === "/market/login" ? `&next=${encodeURIComponent(next)}` : ""}`;
}

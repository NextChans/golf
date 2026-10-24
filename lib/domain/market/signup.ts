/**
 * 가입 2·3단계(/onboarding) 순수 규칙(D-82).
 */
export const DISPLAY_NAME_MAX = 50;

/**
 * 카카오 user_metadata에서 이름 입력칸의 기본값을 고른다(name → full_name → nickname 중 첫 값).
 * user_metadata는 사용자가 바꿀 수 있는 값이므로 **표시용 기본값으로만** 쓴다(권한 판단 금지, 절대 규칙 2).
 */
export function pickDefaultName(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  for (const key of ["name", "full_name", "nickname"] as const) {
    const v = m[key];
    if (typeof v !== "string") continue;
    const t = v.replace(/\s+/g, " ").trim();
    if (t) return [...t].slice(0, DISPLAY_NAME_MAX).join("");
  }
  return "";
}

const under = (path: string, base: string) => path === base || path.startsWith(base + "/") || path.startsWith(base + "?");

export type WelcomeLinks = {
  /** 주 버튼 "회원권 둘러보기" */
  browse: string;
  /** 보조 링크 "내 정보로 이동" */
  profile: string;
  /** 가입 전에 가려던 곳(회원권 앱·내 정보 밖, 예: /bookings/new). 없으면 null */
  resume: string | null;
};

/** 환영 화면 이동 경로. next는 safeNext를 거친 내부 경로다. */
export function welcomeLinks(next: string): WelcomeLinks {
  const fromMarket = under(next, "/market");
  const toMe = under(next, "/me");
  return {
    browse: fromMarket ? next : "/market",
    profile: fromMarket ? "/market/mypage" : "/me",
    resume: fromMarket || toMe ? null : next,
  };
}

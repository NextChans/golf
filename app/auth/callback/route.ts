import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/routing";

// 카카오 OAuth 콜백(PKCE). 코드를 세션으로 교환한 뒤 온보딩 여부는 middleware가 판단한다.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/me");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // 가입 차단 훅(이메일 자가 가입 등)이나 사용자의 동의 취소도 여기로 온다
  const reason = url.searchParams.get("error_description") ?? "로그인에 실패했습니다.";
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason.slice(0, 200))}`, url.origin));
}

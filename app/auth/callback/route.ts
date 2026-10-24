import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toSession } from "@/lib/auth/claims";
import { afterLoginPath, loginErrorPath, safeNext } from "@/lib/auth/routing";

// 카카오 OAuth 콜백(PKCE). 코드를 세션으로 교환한 뒤 온보딩 전 고객은 공개 경로로 가더라도 가입 마무리부터(afterLoginPath).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/me");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getClaims();
      return NextResponse.redirect(new URL(afterLoginPath(next, toSession(data?.claims ?? null)), url.origin));
    }
  }
  // 가입 차단 훅(이메일 자가 가입 등)이나 사용자의 동의 취소도 여기로 온다
  const reason = url.searchParams.get("error_description") ?? "로그인에 실패했습니다.";
  return NextResponse.redirect(new URL(loginErrorPath(next, reason), url.origin));
}

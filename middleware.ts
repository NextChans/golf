import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { toSession } from "@/lib/auth/claims";
import { decideRoute } from "@/lib/auth/routing";

/**
 * 1) Supabase 세션 갱신(쿠키 재발급)  2) 경로 접근 판단.
 * 서버 컴포넌트 가드(lib/auth/guards.ts)가 같은 판단을 한 번 더 한다(절대 규칙 7).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims는 JWT 서명을 검증한다(만료 시 갱신). getSession의 미검증 값을 신뢰하지 않는다.
  const { data } = await supabase.auth.getClaims();
  const session = toSession(data?.claims ?? null);
  const decision = decideRoute(request.nextUrl.pathname, session);

  const carryCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  };

  // Server Action(POST + next-action 헤더)은 리다이렉트하면 액션 프로토콜이 깨진다.
  // 권한 차단만 적용하고 나머지는 각 액션의 서버 가드(lib/auth/guards.ts)가 판단한다.
  if (request.headers.has("next-action") && decision.type === "redirect") {
    return response;
  }

  if (decision.type === "redirect") {
    // decision.to는 항상 내부 경로(safeNext 검증)라 외부로 나가는 리다이렉트는 생기지 않는다.
    // 참고: 로컬 `next start`는 request.url 호스트가 localhost로 고정된다. 로컬·E2E는 localhost:3000을 쓴다.
    return carryCookies(NextResponse.redirect(new URL(decision.to, request.url)));
  }
  if (decision.type === "forbidden") {
    // rewrite의 status 지정은 무시되므로 /403 페이지가 forbidden()으로 403을 응답한다
    return carryCookies(NextResponse.rewrite(new URL("/403", request.url)));
  }
  return response;
}

export const config = {
  // 정적 파일·이미지·브랜드 에셋은 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

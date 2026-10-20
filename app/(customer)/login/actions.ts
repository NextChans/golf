"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/auth/routing";
import { pickOrigin } from "@/lib/auth/origin";

export async function signInWithKakao(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""), "/me");
  const h = await headers();
  // 로그인을 시작한 도메인으로 돌아와야 PKCE 쿠키를 읽을 수 있다(preview 배포 대응)
  const origin = pickOrigin({
    requestHost: h.get("x-forwarded-host") ?? h.get("host"),
    requestProto: h.get("x-forwarded-proto"),
    siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
    vercelUrls: [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL],
  });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent("카카오 로그인을 시작할 수 없습니다.")}`);
  redirect(data.url as never);
}

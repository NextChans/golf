import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 요청 사용자의 세션으로 동작하는 서버 클라이언트(Server Component, Server Action, Route Handler).
 * 감사 로그용으로 원 사용자 IP/UA를 x-client-ip / x-client-ua로 전달한다(D-09).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const h = await headers();
  const clientIp = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const clientUa = h.get("user-agent") ?? "";

  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. 세션 갱신은 middleware가 맡는다.
        }
      },
    },
    global: { headers: { "x-client-ip": clientIp, "x-client-ua": clientUa.slice(0, 500) } },
  });
}

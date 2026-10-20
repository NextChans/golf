import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST 전용. 다른 출처에서 보낸 폼으로 로그아웃시키지 못하도록 Origin을 확인한다.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

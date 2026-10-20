"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";

/** TOTP 등록·검증 완료 기록(감사 로그). 검증 자체는 Supabase Auth가 수행한다. */
export async function recordMfaVerified(enrolled: boolean) {
  const session = await getSession();
  if (!session || session.aal !== "aal2") return;
  const supabase = await createClient();
  await supabase.rpc("record_auth_event", { p_event: enrolled ? "mfa_enrolled" : "admin_signed_in" });
}

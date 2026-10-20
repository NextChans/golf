"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/guards";
import { appError } from "@/lib/domain/errors";
import { passwordSchema } from "@/lib/domain/password";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/** 최초 로그인 시 임시 비밀번호 변경. 성공하면 password_change_required 플래그를 해제한다. */
export async function changeInitialPassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "owner")) return fail(appError("forbidden"));

  const parsed = passwordSchema.safeParse(input.password);
  if (!parsed.success) return fail(appError("invalid_input", parsed.error.issues[0]?.message));
  if (input.password !== input.confirm) return fail(appError("invalid_input", "비밀번호가 서로 다릅니다."));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    const message = error.code === "same_password" ? "임시 비밀번호와 다른 비밀번호를 정해 주세요." : "비밀번호를 바꾸지 못했습니다.";
    return fail(appError("invalid_input", message));
  }

  // app_metadata는 사용자가 바꿀 수 없으므로 서버(Admin API)가 해제한다
  const admin = createAdminClient();
  const { error: flagError } = await admin.auth.admin.updateUserById(session.userId, {
    app_metadata: { password_change_required: false },
  });
  if (flagError) return fail(appError("unknown"));

  await supabase.rpc("record_auth_event", { p_event: "password_changed" });
  await supabase.auth.refreshSession();
  return ok(undefined);
}

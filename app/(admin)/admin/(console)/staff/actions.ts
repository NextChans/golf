"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const createSchema = z.object({ email: z.email().max(254), role: z.enum(["admin", "owner"]) });

/** 임시 비밀번호: 18바이트 난수(base64url) + 영문·숫자 보장. 화면에 한 번만 보여주고 저장하지 않는다. */
function tempPassword() {
  return `Gg${randomBytes(18).toString("base64url")}7`;
}

/**
 * 운영자 계정 발급(D-26). 계정 생성은 Admin API, 역할 부여와 감사는 DB 함수(set_staff_role)가 한다.
 * 역할 부여가 실패하면 만든 계정을 지워 반쪽 상태를 남기지 않는다.
 */
export async function createStaff(input: z.input<typeof createSchema>): Promise<ActionResult<{ email: string; tempPassword: string }>> {
  await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input", "이메일과 역할을 확인해 주세요."));

  const password = tempPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    app_metadata: { password_change_required: true },
  });
  if (error || !data.user) {
    const exists = error?.code === "email_exists" || error?.status === 422;
    return fail(appError("invalid_input", exists ? "이미 등록된 이메일입니다." : "계정을 만들지 못했습니다."));
  }

  const supabase = await createClient();
  const { error: roleError } = await supabase.rpc("set_staff_role", { p_user_id: data.user.id, p_role: parsed.data.role });
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fail(toAppError(roleError));
  }

  revalidatePath("/admin/staff");
  return ok({ email: parsed.data.email, tempPassword: password });
}

const roleSchema = z.object({ userId: z.uuid(), role: z.enum(["admin", "owner"]).nullable() });

/** 역할 변경·회수. 회수 시 DB 함수가 세션을 끊는다. */
export async function setStaffRole(input: z.input<typeof roleSchema>): Promise<ActionResult> {
  await requireOwner();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_role", { p_user_id: parsed.data.userId, p_role: parsed.data.role as string });
  if (error) return fail(toAppError(error));
  revalidatePath("/admin/staff");
  return ok(undefined);
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/** dead 알림 재시도(dead → pending, 감사 로그). 다음 발송 주기(1분)에 다시 보낸다 */
export async function retryNotification(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = z.object({ id: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("retry_notification", { p_id: parsed.data.id });
  if (error) return fail(toAppError(error));
  // 이 화면에는 Suspense 경계(loading.tsx)를 두지 않는다(D-62)
  revalidatePath("/admin/notifications");
  return ok(undefined);
}

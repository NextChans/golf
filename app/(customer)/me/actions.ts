"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { krMobileSchema } from "@/lib/domain/phone";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/** 연락처(확인 전화용) 변경(D-48). 최종 검증·감사 로그는 DB 함수가 한다. */
export async function updateContactPhone(input: { phone: string }): Promise<ActionResult<{ phone: string }>> {
  await requireCustomer();
  const parsed = krMobileSchema.safeParse(input.phone);
  if (!parsed.success) return fail(appError("invalid_input", parsed.error.issues[0]?.message));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_contact_phone", { p_contact_phone: parsed.data });
  if (error || !data) return fail(toAppError(error));
  revalidatePath("/me");
  return ok({ phone: data.phone ?? parsed.data });
}

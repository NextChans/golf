"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { parseActivityNoteForm } from "@/lib/domain/crm/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/**
 * 통화 메모 추가(A-06, append-only). 권한·소유 검증·감사 로그는 DB 함수(add_activity_note)가 한다.
 * useActionState용 시그니처. 성공하면 고객 상세를 다시 그린다.
 */
export async function addNote(_prev: ActionResult<{ id: number }> | null, formData: FormData): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = parseActivityNoteForm(formData);
  if (!parsed.success) return fail(appError("invalid_input", parsed.error.issues[0]?.message));
  const { customerId, subjectType, subjectId, body } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_activity_note", {
    p_customer_id: customerId,
    p_subject_type: subjectType,
    p_subject_id: (subjectId ?? null) as string,
    p_body: body,
  });
  if (error || !data) return fail(toAppError(error));

  revalidatePath(`/admin/customers/${customerId}`);
  return ok({ id: data.id });
}

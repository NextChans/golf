"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { moderateGroupSchema, moderatePostSchema, resolveReportSchema } from "@/lib/domain/community/admin-schema";

// 이 화면에는 Suspense 경계(loading.tsx)를 두지 않는다(D-62). revalidatePath로 제자리 갱신한다
const done = (): ActionResult => {
  revalidatePath("/admin/community");
  return ok(undefined);
};

/** 모임 공개 승인·비공개·복구(moderate_group: active|hidden, 감사 로그, 비공개 시 모임장 알림) */
export async function moderateGroup(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = moderateGroupSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input", parsed.error.issues[0]?.message));
  const { groupId, status, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_group", { p_group_id: groupId, p_status: status, p_reason: reason ?? "" });
  if (error) return fail(toAppError(error));
  return done();
}

/** 게시글 숨기기·복구(moderate_post) */
export async function moderatePost(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = moderatePostSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_post", { p_post_id: parsed.data.postId, p_hidden: parsed.data.hidden });
  if (error) return fail(toAppError(error));
  return done();
}

/** 신고 처리 완료·기각(resolve_report). 같은 대상의 열린 신고가 함께 닫힌다 */
export async function resolveReport(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_report", { p_report_id: parsed.data.reportId, p_status: parsed.data.status });
  if (error) return fail(toAppError(error));
  return done();
}

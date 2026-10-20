"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { adminCancelSchema, assignSchema, fieldErrors, makeProposeSchema, rejectSchema } from "@/lib/domain/booking/admin";

export type AdminFormState = { fieldErrors?: Record<string, string>; error?: string; done?: number };

const formObject = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
const refresh = (id: string) => {
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
};

/** 담당자 배정(A-01). 접수 상태면 확인 중으로 바뀐다 */
export async function assignBooking(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_booking", {
    p_request_id: v.requestId, p_assignee_id: v.assigneeId, p_expected_version: v.expectedVersion,
  });
  if (error) return fail(toAppError(error));
  refresh(v.requestId);
  return ok(undefined);
}

/** 티타임 제안(A-02). 기존 제안이 있으면 DB가 회수 후 새로 제안한다 */
export async function proposeBooking(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireStaff();
  const parsed = makeProposeSchema().safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_booking", {
    p_request_id: v.requestId,
    p_expected_version: v.expectedVersion,
    p_tee_time: v.teeTime,
    p_green_fee_per_person: v.greenFeePerPerson,
    p_valid_minutes: v.validMinutes,
    p_memo: v.memo as string,
  });
  if (error) return { error: toAppError(error).message };
  refresh(v.requestId);
  return { done: Date.now() };
}

/** 예약 불가 처리(A-02). 사유는 고객 타임라인에 노출된다 */
export async function rejectBooking(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireStaff();
  const parsed = rejectSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_booking", {
    p_request_id: v.requestId, p_expected_version: v.expectedVersion, p_reason: v.reason,
  });
  if (error) return { error: toAppError(error).message };
  refresh(v.requestId);
  return { done: Date.now() };
}

/** 운영자 취소(확정 건 포함, 사유 필수, D-03) */
export async function cancelBookingAsAdmin(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireStaff();
  const parsed = adminCancelSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_request_id: v.requestId, p_expected_version: v.expectedVersion, p_reason: v.reason,
  });
  if (error) return { error: toAppError(error).message };
  refresh(v.requestId);
  return { done: Date.now() };
}

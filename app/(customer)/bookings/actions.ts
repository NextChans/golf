"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  acceptProposalSchema,
  cancelBookingSchema,
  declineProposalSchema,
  parseBookingForm,
} from "@/lib/domain/booking/schema";

export type CreateBookingState = {
  fieldErrors?: Partial<Record<string, string>>;
  error?: string;
  createdId?: string;
};

/**
 * 부킹 요청 생성(F-02). 멱등키는 폼 렌더 시 서버가 발급한 값(D-10).
 * 검증은 zod(UX) → DB 함수(최종: 날짜·골프장·rate limit·멱등)의 두 단계.
 */
export async function createBooking(_prev: CreateBookingState, formData: FormData): Promise<CreateBookingState> {
  await requireCustomer();
  const parsed = parseBookingForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_request", {
    p_idempotency_key: v.idempotencyKey,
    p_golf_course_id: v.golfCourseId as string,
    p_course_name_free: v.courseNameFree as string,
    p_play_date: v.playDate,
    p_time_pref: v.timePref,
    p_time_from: v.timeFrom as string,
    p_time_to: v.timeTo as string,
    p_players: v.players,
    p_budget_per_person: v.budgetPerPerson as number,
    p_note: v.note as string,
  });
  if (error || !data) return { error: toAppError(error).message };
  // revalidatePath를 부르지 않는다: 응답과 함께 현재 경로 갱신이 일어나 클라이언트의 router.replace(상세 이동)와
  // 경합해 이동이 버려지는 경우가 있었다(E2E 간헐 실패). /bookings 계열은 쿠키를 읽는 동적 페이지라 캐시되지 않는다.
  return { createdId: data.id };
}

/** 제안 수락(멱등). 동시 수락은 DB의 행 잠금·version으로 1건만 성공한다. */
export async function acceptProposal(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = acceptProposalSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_proposal", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_proposal_id: parsed.data.proposalId,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error || !data) return fail(toAppError(error));
  revalidatePath(`/bookings/${data.id}`);
  revalidatePath("/bookings");
  return ok(undefined);
}

export async function declineProposal(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = declineProposalSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decline_proposal", {
    p_proposal_id: parsed.data.proposalId,
    p_expected_version: parsed.data.expectedVersion,
    p_reason: parsed.data.reason as string,
  });
  if (error || !data) return fail(toAppError(error));
  revalidatePath(`/bookings/${data.id}`);
  revalidatePath("/bookings");
  return ok(undefined);
}

export async function cancelBooking(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = cancelBookingSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking", {
    p_request_id: parsed.data.requestId,
    p_expected_version: parsed.data.expectedVersion,
    p_reason: parsed.data.reason as string,
  });
  if (error || !data) return fail(toAppError(error));
  revalidatePath(`/bookings/${data.id}`);
  revalidatePath("/bookings");
  return ok(undefined);
}

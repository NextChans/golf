"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fieldErrors } from "@/lib/domain/booking/admin";
import {
  advanceDealSchema, assignDealSchema, cancelDealAdminSchema, dealRefSchema, dealTermsSchema,
} from "@/lib/domain/membership/deal-admin";

export type DealFormState = { fieldErrors?: Record<string, string>; error?: string; done?: number };

const formObject = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
const refresh = (id: string) => {
  revalidatePath(`/admin/deals/${id}`);
  revalidatePath("/admin/deals");
};

/** 협의 시작(inquiry → negotiating). 매수 상담이면 매물이 reserved로 바뀐다 */
export async function startDeal(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = dealRefSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_deal", {
    p_deal_id: parsed.data.dealId, p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.dealId);
  return ok(undefined);
}

export async function assignDeal(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = assignDealSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_deal", {
    p_deal_id: v.dealId, p_assignee_id: v.assigneeId, p_expected_version: v.expectedVersion,
  });
  if (error) return fail(toAppError(error));
  refresh(v.dealId);
  return ok(undefined);
}

/** 단계 진행(한 칸). 완료 시 매물 sold */
export async function advanceDeal(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = advanceDealSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_deal", {
    p_deal_id: v.dealId, p_expected_version: v.expectedVersion, p_to_status: v.toStatus,
  });
  if (error) return fail(toAppError(error));
  refresh(v.dealId);
  return ok(undefined);
}

/** 합의가·계약일 저장. DB 함수는 두 값을 모두 덮어쓰므로 폼은 현재 값을 함께 보낸다 */
export async function updateDealTerms(_prev: DealFormState, formData: FormData): Promise<DealFormState> {
  await requireStaff();
  const parsed = dealTermsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_deal_terms", {
    p_deal_id: v.dealId, p_expected_version: v.expectedVersion,
    p_agreed_price: v.agreedPrice as number, p_contract_date: v.contractDate as string,
  });
  if (error) return { error: toAppError(error).message };
  refresh(v.dealId);
  return { done: Date.now() };
}

export async function cancelDealAsAdmin(_prev: DealFormState, formData: FormData): Promise<DealFormState> {
  await requireStaff();
  const parsed = cancelDealAdminSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_deal", {
    p_deal_id: v.dealId, p_expected_version: v.expectedVersion, p_reason: v.reason,
  });
  if (error) return { error: toAppError(error).message };
  refresh(v.dealId);
  return { done: Date.now() };
}

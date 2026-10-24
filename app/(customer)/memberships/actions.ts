"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { toAppError } from "@/lib/domain/errors";
import { parseBuyInquiryForm, parseSellInquiryForm } from "@/lib/domain/membership/schema";

export type CreateInquiryState = {
  fieldErrors?: Partial<Record<string, string>>;
  error?: string;
  createdId?: string;
};

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * 매수 상담 신청(F-05). 멱등키는 폼 렌더 시 서버가 발급한 값(D-10).
 * 매물 상태(listed)·중복 상담·연락처·rate limit은 DB 함수가 최종 판단한다.
 */
export async function createBuyInquiry(_prev: CreateInquiryState, formData: FormData): Promise<CreateInquiryState> {
  await requireCustomer();
  const parsed = parseBuyInquiryForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_deal_inquiry", {
    p_idempotency_key: v.idempotencyKey,
    p_side: "buy",
    p_listing_id: v.listingId,
    p_product_id: null as unknown as string,
    p_desired_price: v.desiredPrice as number,
    p_contact_window: v.contactWindow as string,
    p_note: v.note as string,
  });
  if (error || !data) return { error: toAppError(error).message };
  // revalidatePath를 부르지 않는다: 클라이언트의 router.replace(상세 이동)와 경합한다.
  // /deals 계열은 쿠키를 읽는 동적 페이지라 캐시되지 않는다.
  return { createdId: data.id };
}

/** 매도 상담 신청(F-05, D-18: 매물 없이 상품 기준) */
export async function createSellInquiry(_prev: CreateInquiryState, formData: FormData): Promise<CreateInquiryState> {
  await requireCustomer();
  const parsed = parseSellInquiryForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_deal_inquiry", {
    p_idempotency_key: v.idempotencyKey,
    p_side: "sell",
    p_listing_id: null as unknown as string,
    p_product_id: v.productId,
    p_desired_price: v.desiredPrice as number,
    p_contact_window: v.contactWindow as string,
    p_note: v.note as string,
  });
  if (error || !data) return { error: toAppError(error).message };
  return { createdId: data.id };
}

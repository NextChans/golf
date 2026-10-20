"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { toAppError } from "@/lib/domain/errors";
import {
  parseListingForm,
  parseProductForm,
  parseQuoteForm,
  parseVisibilityForm,
  toFieldErrors,
} from "@/lib/domain/membership/admin-schema";

export type MembershipFormState = {
  fieldErrors?: Partial<Record<string, string>>;
  error?: string;
  savedId?: string;
  /** 저장 성공 시각(폼 초기화 key·완료 메시지용) */
  savedAt?: number;
};

/**
 * 운영자 화면과 고객 매물 화면(공개 여부·호가가 바뀌므로)을 함께 갱신한다.
 * revalidatePath는 서버 캐시뿐 아니라 이 브라우저의 클라이언트 라우터 캐시(prefetch 포함)도 비운다.
 * 빼면 저장 후 router.replace로 돌아간 목록이 미리 받아 둔 옛 데이터로 그려진다(D-62).
 * 현재 화면은 액션 응답에 실린 새 RSC로 갱신되므로 클라이언트에서 router.refresh()를 따로 부르지 않는다.
 */
function revalidateMemberships() {
  revalidatePath("/admin/memberships", "layout");
  revalidatePath("/memberships", "layout");
}

/**
 * 회원권 상품 생성·수정(A-04). 권한·중복(골프장×종류)·감사 로그는 DB 함수(upsert_membership_product)가 최종 판단한다.
 * 성공 시 이동은 클라이언트가 router.replace로 한다(Server Action 안에서 redirect 금지).
 */
export async function saveProduct(_prev: MembershipFormState, formData: FormData): Promise<MembershipFormState> {
  await requireStaff();
  const parsed = parseProductForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_membership_product", {
    p_id: v.id as string,
    p_golf_course_id: v.golfCourseId,
    p_kind: v.kind,
    p_name: v.name,
    p_is_active: v.isActive,
  });
  if (error || !data) return { error: toAppError(error).message };
  revalidateMemberships();
  return { savedId: data.id, savedAt: Date.now() };
}

/** 매물 생성·수정. 새 매물은 비공개(hidden)로 만들어지고, 상담 중(reserved)이면 상품·호가 변경을 DB가 거부한다 */
export async function saveListing(_prev: MembershipFormState, formData: FormData): Promise<MembershipFormState> {
  await requireStaff();
  const parsed = parseListingForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_listing", {
    p_id: v.id as string,
    p_product_id: v.productId,
    p_asking_price: v.askingPrice,
    p_description: v.description as string,
  });
  if (error || !data) return { error: toAppError(error).message };
  revalidateMemberships();
  return { savedId: data.id, savedAt: Date.now() };
}

/** 시세 저장(상품·기준일당 1건, 같은 날은 덮어쓰기). 미래 날짜 금지는 DB도 KST 기준으로 검사한다 */
export async function saveQuote(_prev: MembershipFormState, formData: FormData): Promise<MembershipFormState> {
  await requireStaff();
  const parsed = parseQuoteForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_quote", {
    p_product_id: v.productId,
    p_quoted_on: v.quotedOn,
    p_buy_price: v.buyPrice as number,
    p_sell_price: v.sellPrice as number,
  });
  if (error || !data) return { error: toAppError(error).message };
  revalidateMemberships();
  return { savedId: String(data.id), savedAt: Date.now() };
}

/** 공개/비공개 전환(hidden ↔ listed만). 상담 중·판매완료 매물은 DB가 invalid_state로 거부한다 */
export async function setListingVisibility(_prev: MembershipFormState, formData: FormData): Promise<MembershipFormState> {
  await requireStaff();
  const parsed = parseVisibilityForm(formData);
  if (!parsed.success) return { error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_listing_visibility", {
    p_listing_id: parsed.data.listingId,
    p_visible: parsed.data.visible,
  });
  if (error || !data) return { error: toAppError(error).message };
  revalidateMemberships();
  return { savedId: data.id, savedAt: Date.now() };
}

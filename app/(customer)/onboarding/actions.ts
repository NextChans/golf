"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSignedInCustomer } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { krMobileSchema } from "@/lib/domain/phone";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/** 1단계: 휴대폰 번호 변경 요청 → Auth가 OTP를 발송한다(로컬은 test_otp). */
export async function sendPhoneOtp(input: { phone: string }): Promise<ActionResult<{ phone: string }>> {
  await requireSignedInCustomer();
  const parsed = krMobileSchema.safeParse(input.phone);
  if (!parsed.success) return fail(appError("invalid_input", parsed.error.issues[0]?.message));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ phone: parsed.data });
  if (error) {
    if (error.code === "phone_exists") return fail(appError("invalid_input", "이미 다른 계정에 등록된 번호입니다."));
    if (error.status === 429) return fail(appError("rate_limited"));
    return fail(appError("unknown", "인증번호를 보내지 못했습니다. 잠시 후 다시 시도해 주세요."));
  }
  return ok({ phone: parsed.data });
}

/** 2단계: OTP 검증 → auth.users.phone, phone_confirmed_at 확정 */
export async function verifyPhoneOtp(input: { phone: string; token: string }): Promise<ActionResult> {
  await requireSignedInCustomer();
  const phone = krMobileSchema.safeParse(input.phone);
  const token = z.string().regex(/^\d{6}$/).safeParse(input.token);
  if (!phone.success || !token.success) return fail(appError("invalid_input", "인증번호 6자리를 입력해 주세요."));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone: phone.data, token: token.data, type: "phone_change" });
  if (error) return fail(appError("invalid_input", "인증번호가 올바르지 않거나 만료되었습니다."));
  return ok(undefined);
}

const completeSchema = z.object({
  displayName: z.string().trim().min(1, "이름을 입력해 주세요.").max(50),
  agreed: z.array(z.string().regex(/^[a-z_]{2,40}$/)).max(20),
  // 휴대폰 인증 생략 모드(D-42)에서 직접 입력하는 연락처(D-48). 인증 필수 모드에서는 무시된다.
  contactPhone: krMobileSchema.optional(),
});

/** 3단계: 이름·약관 동의 → DB 함수가 휴대폰 인증 여부와 필수 약관을 최종 검증한다 */
export async function completeOnboarding(input: z.input<typeof completeSchema>): Promise<ActionResult> {
  await requireSignedInCustomer();
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input", parsed.error.issues[0]?.message));

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_display_name: parsed.data.displayName,
    p_agreed_codes: parsed.data.agreed,
    p_contact_phone: parsed.data.contactPhone as string,
  });
  if (error) return fail(toAppError(error));
  // app_metadata.onboarded를 즉시 claim에 반영(middleware 판단용)
  await supabase.auth.refreshSession();
  return ok(undefined);
}

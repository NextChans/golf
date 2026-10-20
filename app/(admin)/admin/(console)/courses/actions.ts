"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { toAppError } from "@/lib/domain/errors";
import { parseCourseForm } from "@/lib/domain/course/schema";

export type SaveCourseState = {
  fieldErrors?: Partial<Record<string, string>>;
  error?: string;
  savedId?: string;
};

/**
 * 골프장 마스터 생성·수정(A-03). 권한·중복 이름·감사 로그는 DB 함수(upsert_golf_course)가 최종 판단한다.
 * 성공 시 이동은 클라이언트가 router.replace로 한다(Server Action 안에서 redirect 금지).
 */
export async function saveCourse(_prev: SaveCourseState, formData: FormData): Promise<SaveCourseState> {
  await requireStaff();
  const parsed = parseCourseForm(formData);
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
  const { data, error } = await supabase.rpc("upsert_golf_course", {
    p_id: v.id as string,
    p_name: v.name,
    p_region: v.region,
    p_address: v.address as string,
    p_weekday_green_fee: v.weekdayGreenFee as number,
    p_weekend_green_fee: v.weekendGreenFee as number,
    p_cancellation_policy: v.cancellationPolicy as string,
    p_contact_phone: v.contactPhone as string,
    p_is_active: v.isActive,
  });
  if (error || !data) return { error: toAppError(error).message };
  // revalidatePath를 부르지 않는다: 클라이언트의 router.replace(목록 이동)와 경합한다(createBooking 주석 참고).
  // 목록은 쿠키를 읽는 동적 페이지라 이동 시 새로 렌더된다. 고객 부킹 폼의 골프장 목록도 동적이다.
  return { savedId: data.id };
}

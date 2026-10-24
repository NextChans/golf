import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 운영자가 고객 연락처(전체 번호)를 화면에 띄울 때 감사 로그를 남긴다(D-75).
 * 같은 운영자·대상은 DB가 10분에 1건으로 줄인다. 기록 실패로 업무 화면을 막지는 않지만 서버 로그에 남긴다.
 */
export async function logPiiView(supabase: Supabase, subjectType: "customer" | "deal", subjectId: string) {
  const { error } = await supabase.rpc("log_pii_view", { p_subject_type: subjectType, p_subject_id: subjectId });
  if (error) console.error(JSON.stringify({ event: "pii_view.log_failed", subjectType, code: error.code }));
}

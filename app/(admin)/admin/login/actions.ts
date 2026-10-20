"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/routing";

export type LoginState = { error?: string; next?: string };

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

/**
 * 성공 시 이동할 경로만 돌려주고 이동은 클라이언트가 한다.
 * Server Action 안의 redirect()는 내부 요청(localhost)으로 대상을 렌더해 middleware 리다이렉트 호스트가 어긋난다.
 */
export async function adminSignIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  // 계정 존재 여부를 알 수 없도록 실패 메시지는 하나로 통일한다
  const generic = { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  if (!parsed.success) return generic;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return error?.status === 429 ? { error: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." } : generic;

  // 다음 단계(비밀번호 변경 → MFA)는 middleware가 결정한다
  return { next: safeNext(String(formData.get("next") ?? ""), "/admin") };
}

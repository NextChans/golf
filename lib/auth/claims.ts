import { z } from "zod";

// Supabase access token claims 중 권한 판단에 쓰는 부분만. user_metadata는 읽지 않는다(절대 규칙 2).
const claimsSchema = z.object({
  sub: z.string(),
  aal: z.enum(["aal1", "aal2"]).catch("aal1"),
  app_metadata: z
    .object({
      role: z.string().optional(),
      providers: z.array(z.string()).optional(),
      onboarded: z.boolean().optional(),
      password_change_required: z.boolean().optional(),
    })
    .catch({}),
});

export type Session = {
  userId: string;
  role: "customer" | "admin" | "owner";
  aal: "aal1" | "aal2";
  isKakao: boolean;
  onboarded: boolean;
  passwordChangeRequired: boolean;
};

export function toSession(raw: unknown): Session | null {
  const parsed = claimsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { sub, aal, app_metadata: meta } = parsed.data;
  const isKakao = meta.providers?.includes("kakao") ?? false;
  // DB의 app.jwt_role / app.is_admin과 같은 규칙: 카카오 계정은 역할이 무엇이든 고객
  const role = !isKakao && (meta.role === "admin" || meta.role === "owner") ? meta.role : "customer";
  return {
    userId: sub,
    role,
    aal,
    isKakao,
    onboarded: meta.onboarded === true,
    passwordChangeRequired: meta.password_change_required === true,
  };
}

export const isStaff = (s: Session | null) => s?.role === "admin" || s?.role === "owner";

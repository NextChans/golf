import "server-only";
import { z } from "zod";

// 서버 전용 비밀값. 이 모듈을 클라이언트 번들에서 import하면 빌드가 실패한다(server-only).
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({ SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY });
  return cached;
}

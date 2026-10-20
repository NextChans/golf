import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * service_role 클라이언트. Auth Admin API(운영자 계정 발급·플래그 변경) 전용.
 * 테이블 DML 권한은 DB에서 회수되어 있다(D-29). 데이터 변경은 사용자 세션 + rpc로 한다.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

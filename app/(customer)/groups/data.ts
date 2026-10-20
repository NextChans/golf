import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 모임 + 내 멤버십(있으면). 모임은 RLS가 거른다: 활성 모임은 누구나, 그 외 상태는 멤버(대기 포함)만.
 * 연락처(profiles.phone)는 커뮤니티 어디에서도 조회하지 않는다(닉네임 스냅샷 display_name만).
 */
export async function loadGroup(id: string) {
  const session = await getSession();
  const isCustomer = session?.role === "customer";
  const supabase = await createClient();
  const [groupRes, meRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, type, region, description, join_policy, capacity, member_count, open_chat_url, status, status_reason, owner_id, version, created_at")
      .eq("id", id)
      .maybeSingle(),
    isCustomer
      ? supabase
          .from("group_members")
          .select("role, status, display_name")
          .eq("group_id", id)
          .eq("user_id", session.userId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);
  if (groupRes.error) throw new Error("group query failed");
  return { supabase, session, isCustomer, group: groupRes.data, me: meRes?.data ?? null };
}

import type { Channel, OutboxItem, OutboxStore } from "./types.ts";

/**
 * PostgREST RPC로 outbox를 다루는 저장소. supabase-js 없이 fetch만 쓴다(Edge 런타임 의존 최소화).
 * serviceKey는 service_role 키(claim/complete/fail은 service_role에만 실행 권한이 있다).
 */
export function createRestStore(supabaseUrl: string, serviceKey: string, fetchImpl: typeof fetch = fetch): OutboxStore {
  const base = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc`;
  const rpc = async <T>(fn: string, body: Record<string, unknown>): Promise<T> => {
    const res = await fetchImpl(`${base}/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      let code = String(res.status);
      try {
        code = (JSON.parse(text) as { code?: string }).code ?? code;
      } catch {
        // 본문이 JSON이 아니면 HTTP 상태 코드만 남긴다
      }
      throw new Error(`${fn} failed: ${code}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  };
  return {
    claim: (limit) => rpc<OutboxItem[] | null>("claim_notifications", { p_limit: limit }).then((r) => r ?? []),
    complete: async (id: number, channel: Channel, messageId: string) => {
      await rpc("complete_notification", { p_id: id, p_channel: channel, p_provider_message_id: messageId });
    },
    fail: (id: number, error: string) => rpc<"failed" | "dead">("fail_notification", { p_id: id, p_error: error }),
  };
}

import { renderMessage } from "./templates.ts";
import type { AdapterSet } from "./adapters.ts";
import type { Channel, OutboxItem, OutboxStore, SendResult } from "./types.ts";

/** 오류 메시지는 last_error·운영자 알림에 남으므로 짧게 자르고 전화번호 형태를 지운다 */
export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return raw.replace(/\+?\d[\d\s-]{8,}\d/g, "[번호]").slice(0, 300);
}

/**
 * 한 건 발송. 고객은 알림톡 → 실패 시 SMS 대체(N-02), 운영자는 Slack.
 * 둘 다 실패하면 마지막 오류를 던진다(호출자가 fail_notification으로 백오프).
 */
export async function deliver(item: OutboxItem, adapters: AdapterSet, siteUrl: string): Promise<{ channel: Channel } & SendResult> {
  const message = renderMessage(item, siteUrl);
  const input = { to: item.recipient_phone, message, dedupeKey: item.dedupe_key, templateCode: item.template_code };

  if (item.recipient_kind === "admins") {
    return { channel: "slack", ...(await adapters.slack.send(input)) };
  }
  if (!item.recipient_phone) {
    throw new Error("recipient has no phone");
  }
  try {
    return { channel: "alimtalk", ...(await adapters.alimtalk.send(input)) };
  } catch (alimtalkError) {
    try {
      return { channel: "sms", ...(await adapters.sms.send(input)) };
    } catch (smsError) {
      throw new Error(`alimtalk: ${sanitizeError(alimtalkError)} / sms: ${sanitizeError(smsError)}`);
    }
  }
}

export type DispatchSummary = { claimed: number; sent: number; failed: number; dead: number; errors: number };

/**
 * claim → 발송 → 결과 기록. 한 건의 실패가 다른 건을 막지 않는다.
 * 결과 기록(complete/fail) 자체가 실패하면 그 건은 lease 만료 후 다시 잡힌다(중복 발송 가능성은 dedupe_key로 대행사 측 멱등 처리).
 */
export async function runDispatch(store: OutboxStore, adapters: AdapterSet, opts: { siteUrl: string; limit?: number }): Promise<DispatchSummary> {
  const items = await store.claim(opts.limit ?? 20);
  const summary: DispatchSummary = { claimed: items.length, sent: 0, failed: 0, dead: 0, errors: 0 };
  for (const item of items) {
    try {
      const result = await deliver(item, adapters, opts.siteUrl);
      await store.complete(item.id, result.channel, result.messageId);
      summary.sent += 1;
    } catch (err) {
      try {
        const status = await store.fail(item.id, sanitizeError(err));
        summary[status] += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }
  return summary;
}

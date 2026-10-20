import { DeliveryError, type Adapter, type Channel, type SendInput, type SendResult } from "./types.ts";

/** +821012345678 → 010-****-5678 (lib/domain/phone.ts maskPhone과 같은 형식, 런타임 독립을 위해 복제) */
export function maskPhone(e164: string | null): string {
  if (!e164) return "-";
  const digits = (e164.startsWith("+82") ? `0${e164.slice(3)}` : e164).replace(/\D/g, "");
  return digits.length < 8 ? "***" : `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 개발·무료 단계 기본 어댑터: 실제로 보내지 않고 로그만 남긴다(전화번호는 가린다) */
export class ConsoleAdapter implements Adapter {
  readonly name = "console";
  constructor(readonly channel: Channel, private readonly log: (line: string) => void = console.log) {}
  async send({ to, message, dedupeKey }: SendInput): Promise<SendResult> {
    const masked = maskPhone(to);
    this.log(`[notify:${this.channel}] to=${masked} ${message.title} — ${message.text}${message.url ? ` ${message.url}` : ""}`);
    return { messageId: `console:${dedupeKey}` };
  }
}

/** Slack(또는 Discord 호환) Incoming Webhook. 운영자 알림 채널 */
export class SlackWebhookAdapter implements Adapter {
  readonly channel = "slack" as const;
  readonly name = "slack-webhook";
  constructor(private readonly webhookUrl: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async send({ message, dedupeKey }: SendInput): Promise<SendResult> {
    const text = `*${message.title}*\n${message.text}${message.url ? `\n<${message.url}|열기>` : ""}`;
    const res = await this.fetchImpl(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(10_000),
    });
    // 4xx(웹훅 삭제·잘못된 URL)도 같은 횟수로 재시도한 뒤 dead로 둔다. 설정을 고친 뒤 운영자 재시도(retry_notification)로 다시 보낸다
    if (!res.ok) throw new DeliveryError(`slack webhook ${res.status}`);
    return { messageId: `slack:${dedupeKey}` };
  }
}

/**
 * 알림톡·SMS 대행사 어댑터 자리. 대행사 계약 전(무료 단계)에는 ConsoleAdapter를 쓴다(D-25).
 * 계약 후 같은 인터페이스로 구현하고 createAdapters에서 환경변수로 고른다.
 */
export type AdapterSet = { alimtalk: Adapter; sms: Adapter; slack: Adapter };

export function createAdapters(env: { SLACK_WEBHOOK_URL?: string; NOTIFY_CUSTOMER_PROVIDER?: string }, log?: (l: string) => void): AdapterSet {
  const provider = env.NOTIFY_CUSTOMER_PROVIDER ?? "console";
  if (provider !== "console") {
    // 알 수 없는 대행사 이름으로 조용히 콘솔 발송하면 고객이 알림을 못 받는다는 사실이 가려진다
    throw new Error(`unknown NOTIFY_CUSTOMER_PROVIDER: ${provider}`);
  }
  return {
    alimtalk: new ConsoleAdapter("alimtalk", log),
    sms: new ConsoleAdapter("sms", log),
    slack: env.SLACK_WEBHOOK_URL ? new SlackWebhookAdapter(env.SLACK_WEBHOOK_URL) : new ConsoleAdapter("slack", log),
  };
}

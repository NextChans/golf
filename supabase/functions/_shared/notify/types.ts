/**
 * 알림 발송 공통 타입(M6). Edge Function(Deno)과 Vitest(Node) 양쪽에서 쓰므로
 * 런타임 전용 API(Deno.*, node:*)를 쓰지 않고 fetch만 사용한다.
 */
export type Channel = "alimtalk" | "sms" | "slack" | "email";

/** claim_notifications가 돌려주는 행 */
export type OutboxItem = {
  id: number;
  event_type: string;
  recipient_kind: "customer" | "admins";
  recipient_phone: string | null;
  channel: Channel;
  template_code: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  attempts: number;
};

/** 렌더된 메시지. 고객 메시지는 알림톡·SMS 공통 본문을 쓴다 */
export type Message = { title: string; text: string; url?: string };

export type SendInput = { to: string | null; message: Message; dedupeKey: string; templateCode: string };
export type SendResult = { messageId: string };

/** 채널 어댑터. 실패는 예외로 던진다(메시지는 last_error에 남으므로 개인정보를 넣지 않는다) */
export interface Adapter {
  readonly channel: Channel;
  readonly name: string;
  send(input: SendInput): Promise<SendResult>;
}

/** 발송기가 DB에 요구하는 최소 인터페이스(supabase-js rpc를 감싼다, 테스트에서는 가짜 구현) */
export interface OutboxStore {
  claim(limit: number): Promise<OutboxItem[]>;
  complete(id: number, channel: Channel, messageId: string): Promise<void>;
  fail(id: number, error: string): Promise<"failed" | "dead">;
}

/** 대행사·웹훅 응답 실패. 재시도 여부는 DB(fail_notification)의 횟수 정책이 정한다 */
export class DeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryError";
  }
}

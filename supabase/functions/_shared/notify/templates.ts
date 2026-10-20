import type { Message, OutboxItem } from "./types.ts";

/**
 * 템플릿 코드 → 메시지. 알림톡 템플릿 심사 전이므로 문구는 여기서 관리한다(D-63).
 * 고객 메시지에는 이름·전화번호를 넣지 않는다(링크로 상세 확인).
 */
const won = (v: unknown) => (typeof v === "number" ? `${v.toLocaleString("ko-KR")}원` : "");
const str = (v: unknown, fallback = "") => (typeof v === "string" && v ? v : fallback);
const kst = (v: unknown) => {
  if (typeof v !== "string") return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
};

type Render = (p: Record<string, unknown>, site: string) => Message;

const booking = (p: Record<string, unknown>, site: string) => `${site}/bookings/${str(p.request_id)}`;
const deal = (p: Record<string, unknown>, site: string) => `${site}/deals/${str(p.deal_id)}`;
const adminBooking = (p: Record<string, unknown>, site: string) => `${site}/admin/bookings/${str(p.request_id)}`;
const adminDeal = (p: Record<string, unknown>, site: string) => `${site}/admin/deals/${str(p.deal_id)}`;
const course = (p: Record<string, unknown>) => str(p.course_name, "골프장");

const TEMPLATES: Record<string, Render> = {
  BOOKING_IN_REVIEW: (p, s) => ({ title: "부킹 요청 확인 중", text: `${course(p)} ${str(p.play_date)} 요청을 담당자가 확인하고 있습니다.`, url: booking(p, s) }),
  BOOKING_PROPOSED: (p, s) => ({
    title: "티타임 제안 도착",
    text: `${course(p)} ${kst(p.tee_time)} 1인 ${won(p.green_fee_per_person)}. ${kst(p.expires_at)}까지 확정해 주세요.`,
    url: booking(p, s),
  }),
  BOOKING_CONFIRMED: (p, s) => ({ title: "예약 확정", text: `${course(p)} ${kst(p.tee_time)} 예약이 확정되었습니다.`, url: booking(p, s) }),
  BOOKING_REJECTED: (p, s) => ({ title: "예약 불가 안내", text: `${course(p)} 요청은 예약이 어렵습니다. 사유: ${str(p.reason, "-")}`, url: booking(p, s) }),
  BOOKING_CANCELLED: (p, s) => ({ title: "예약 취소 안내", text: `${course(p)} 예약이 취소되었습니다. 사유: ${str(p.reason, "-")}`, url: booking(p, s) }),
  BOOKING_PROPOSAL_EXPIRED: (p, s) => ({ title: "제안 만료", text: `${course(p)} 티타임 제안 유효시간이 지났습니다. 담당자가 다시 확인합니다.`, url: booking(p, s) }),
  DEAL_STATUS_CHANGED: (p, s) => ({ title: "회원권 상담 진행", text: `${str(p.product_name, "회원권")} 상담이 '${str(p.status_label)}' 단계입니다.`, url: deal(p, s) }),

  ADMIN_BOOKING_REQUESTED: (p, s) => ({ title: "새 부킹 요청", text: `${course(p)} ${str(p.play_date)} ${p.players ?? ""}명`, url: adminBooking(p, s) }),
  ADMIN_BOOKING_CONFIRMED: (p, s) => ({ title: "부킹 확정", text: `${course(p)} ${str(p.play_date)} 고객이 확정했습니다.`, url: adminBooking(p, s) }),
  ADMIN_BOOKING_CANCELLED: (p, s) => ({ title: "고객 부킹 취소", text: `${course(p)} ${str(p.play_date)}`, url: adminBooking(p, s) }),
  ADMIN_PROPOSAL_DECLINED: (p, s) => ({ title: "제안 거절", text: `${course(p)} 고객이 제안을 거절했습니다. ${str(p.reason)}`, url: adminBooking(p, s) }),
  ADMIN_PROPOSAL_EXPIRED: (p, s) => ({ title: "제안 만료", text: `${course(p)} ${str(p.play_date)} 제안이 만료되었습니다.`, url: adminBooking(p, s) }),
  ADMIN_SLA_BREACHED: (p, s) => ({ title: "SLA 초과", text: `${course(p)} ${str(p.play_date)} 요청이 응답 기한을 넘겼습니다.`, url: adminBooking(p, s) }),
  ADMIN_DEAL_REQUESTED: (p, s) => ({ title: "새 회원권 상담", text: `${str(p.product_name, "회원권")} ${p.side === "sell" ? "매도" : "매수"} 상담`, url: adminDeal(p, s) }),
  ADMIN_DEAL_CANCELLED: (p, s) => ({ title: "고객 상담 취소", text: `${str(p.product_name, "회원권")} 상담`, url: adminDeal(p, s) }),
  ADMIN_NOTIFICATION_DEAD: (p) => ({
    title: "알림 발송 실패",
    text: `${str(p.template_code)} 알림(#${p.outbox_id ?? "?"})이 ${p.attempts ?? "?"}회 실패했습니다. 오류: ${str(p.last_error, "-")}`,
  }),
};

export function renderMessage(item: Pick<OutboxItem, "template_code" | "payload">, siteUrl: string): Message {
  const render = TEMPLATES[item.template_code];
  const site = siteUrl.replace(/\/+$/, "");
  if (!render) return { title: "Googolf 알림", text: item.template_code, url: site };
  return render(item.payload ?? {}, site);
}

export const KNOWN_TEMPLATES = Object.keys(TEMPLATES);

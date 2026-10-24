import type { Message, OutboxItem } from "./types.ts";

/**
 * 템플릿 코드 → 메시지. 알림톡 템플릿 심사 전이므로 문구는 여기서 관리한다(D-63).
 * 고객 메시지에는 이름·전화번호를 넣지 않는다(링크로 상세 확인).
 * 부킹 템플릿(BOOKING_*, ADMIN_BOOKING_*, ADMIN_PROPOSAL_*, ADMIN_SLA_BREACHED)은 D-88로 제거했다.
 * 예전 행(sent·dead 이력)을 운영자가 다시 보내면 모르는 템플릿 기본 문구로 나간다(renderMessage).
 */
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

const deal = (p: Record<string, unknown>, site: string) => `${site}/deals/${str(p.deal_id)}`;
const adminDeal = (p: Record<string, unknown>, site: string) => `${site}/admin/deals/${str(p.deal_id)}`;
const group = (p: Record<string, unknown>, site: string) => `${site}/groups/${str(p.group_id)}`;

const TEMPLATES: Record<string, Render> = {
  DEAL_STATUS_CHANGED: (p, s) => ({ title: "회원권 상담 진행", text: `${str(p.product_name, "회원권")} 상담이 '${str(p.status_label)}' 단계입니다.`, url: deal(p, s) }),

  ADMIN_DEAL_REQUESTED: (p, s) => ({ title: "새 회원권 상담", text: `${str(p.product_name, "회원권")} ${p.side === "sell" ? "매도" : "매수"} 상담`, url: adminDeal(p, s) }),
  ADMIN_DEAL_CANCELLED: (p, s) => ({ title: "고객 상담 취소", text: `${str(p.product_name, "회원권")} 상담`, url: adminDeal(p, s) }),
  GROUP_JOIN_APPROVED: (p, s) => ({ title: "모임 가입 승인", text: `'${str(p.group_name, "모임")}' 가입이 승인되었습니다.`, url: group(p, s) }),
  GROUP_MEETING_CREATED: (p, s) => ({ title: "새 정모", text: `'${str(p.group_name, "모임")}' ${str(p.title)} — ${kst(p.starts_at)}`, url: group(p, s) }),
  GROUP_MEETING_CANCELLED: (p, s) => ({ title: "정모 취소", text: `'${str(p.group_name, "모임")}' ${str(p.title)}(${kst(p.starts_at)}) 정모가 취소되었습니다.`, url: group(p, s) }),
  GROUP_HIDDEN: (p, s) => ({ title: "모임 비공개 처리", text: `'${str(p.group_name, "모임")}' 모임이 운영 정책에 따라 비공개되었습니다. 사유: ${str(p.reason, "-")}`, url: group(p, s) }),
  ADMIN_GROUP_REVIEW: (p, s) => ({ title: "모임 검수 필요", text: `'${str(p.group_name)}' 금칙어 자동 보류`, url: `${s}/admin/community` }),
  ADMIN_COMMUNITY_REPORTED: (p, s) => ({ title: "커뮤니티 신고", text: `${str(p.target_type)} 신고(${str(p.reason)}), 누적 ${p.open_count ?? "?"}건`, url: `${s}/admin/community` }),
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

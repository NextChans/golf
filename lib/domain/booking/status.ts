import type { Database } from "@/types/database";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type ProposalStatus = Database["public"]["Enums"]["proposal_status"];
export type TimePref = Database["public"]["Enums"]["time_pref"];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "접수",
  in_review: "확인 중",
  proposed: "제안 도착",
  confirmed: "예약 확정",
  rejected: "예약 불가",
  cancelled: "취소됨",
};

/** shadcn Badge variant */
export const BOOKING_STATUS_VARIANT: Record<BookingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  requested: "secondary",
  in_review: "secondary",
  proposed: "default",
  confirmed: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export const TIME_PREF_LABEL: Record<TimePref, string> = {
  part_1: "1부",
  part_2: "2부",
  range: "시간 지정",
};

/** 1부·2부 고정 시간(D-12) */
const FIXED_RANGE: Record<Exclude<TimePref, "range">, string> = {
  part_1: "06:00~10:00",
  part_2: "11:00~15:00",
};

/** DB time 값("07:00:00")은 초를 버린다 */
const hhmm = (t: string) => t.slice(0, 5);

/** "1부 (06:00~10:00)" / "07:00~09:30" */
export function describeTimePref(pref: TimePref, from: string | null, to: string | null): string {
  if (pref !== "range") return `${TIME_PREF_LABEL[pref]} (${FIXED_RANGE[pref]})`;
  return from && to ? `${hhmm(from)}~${hhmm(to)}` : TIME_PREF_LABEL.range;
}

/** 고객 버튼 노출. DB 함수(accept/decline/cancel)의 허용 상태와 맞춘다. 확정 후 취소는 운영자만(D-03) */
export function customerActions(
  status: BookingStatus,
  hasOfferedProposal: boolean,
): { canAccept: boolean; canDecline: boolean; canCancel: boolean } {
  const decidable = status === "proposed" && hasOfferedProposal;
  return {
    canAccept: decidable,
    canDecline: decidable,
    canCancel: status === "requested" || status === "in_review" || status === "proposed",
  };
}

/** 더 이상 전이가 없는 상태. confirmed는 운영자 취소가 가능해 종료 아님 */
export function isTerminal(status: BookingStatus): boolean {
  return status === "rejected" || status === "cancelled";
}

/** 고객이 더 할 수 있는 일이 없는 상태 */
export function isClosedForCustomer(status: BookingStatus): boolean {
  return status === "confirmed" || isTerminal(status);
}

/** 남은 시간 표시: "N분 N초" / "N시간 N분" / "N일 N시간" */
export function formatRemaining(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "만료됨";
  // 올림: 만료 직전까지 0초로 보이지 않게 한다
  const s = Math.ceil(ms / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
  return `${Math.floor(s / 86400)}일 ${Math.floor((s % 86400) / 3600)}시간`;
}

/** 클라이언트 시계 오차 보정: 렌더 시점의 서버 시각 + 그 후 경과(클라이언트 기준) */
export function remainingMs(expiresAtIso: string, serverNowMs: number, clientNowAtRenderMs: number, clientNowMs: number): number {
  const expires = Date.parse(expiresAtIso);
  if (Number.isNaN(expires)) return 0;
  return expires - (serverNowMs + (clientNowMs - clientNowAtRenderMs));
}

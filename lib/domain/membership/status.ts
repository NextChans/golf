import type { Database } from "@/types/database";

export type DealStatus = Database["public"]["Enums"]["deal_status"];
export type DealSide = Database["public"]["Enums"]["deal_side"];
export type ListingStatus = Database["public"]["Enums"]["listing_status"];

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  inquiry: "상담 접수",
  negotiating: "협의 중",
  contract_scheduled: "계약 예정",
  contracted: "계약 완료",
  transferring: "명의 이전 중",
  completed: "거래 완료",
  cancelled: "취소됨",
};

export const DEAL_SIDE_LABEL: Record<DealSide, string> = { buy: "매수", sell: "매도" };

/** shadcn Badge variant. 진행 중은 그린, 접수는 회색, 취소는 테두리(DESIGN.md 상태 표현) */
export const DEAL_STATUS_VARIANT: Record<DealStatus, "default" | "secondary" | "destructive" | "outline"> = {
  inquiry: "secondary",
  negotiating: "default",
  contract_scheduled: "default",
  contracted: "default",
  transferring: "default",
  completed: "default",
  cancelled: "outline",
};

/** 고객에게 보이는 매물 상태. listed 외에는 상담 신청 불가(reserved = 다른 고객과 협의 중) */
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  listed: "상담 가능",
  reserved: "상담 중",
  sold: "거래 완료",
  hidden: "비공개",
};

/** 진행 단계 순서(상태 머신 docs/state-machine.md, cancelled는 별도) */
export const DEAL_STAGES = [
  "inquiry", "negotiating", "contract_scheduled", "contracted", "transferring", "completed",
] as const satisfies readonly DealStatus[];

/** 단계 인덱스. cancelled는 -1 */
export function stageIndex(status: DealStatus): number {
  return (DEAL_STAGES as readonly DealStatus[]).indexOf(status);
}

/** 고객 직접 취소 가능 여부. DB `cancel_deal`의 고객 허용 상태와 맞춘다(이후는 담당자 문의) */
export function customerCanCancel(status: DealStatus): boolean {
  return status === "inquiry" || status === "negotiating";
}

/** 고객 목록·상세에서 보여 주는 매물 상태(공개 목록은 listed·reserved만) */
export const PUBLIC_LISTING_STATUSES = ["listed", "reserved"] as const satisfies readonly ListingStatus[];

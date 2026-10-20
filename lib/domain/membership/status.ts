import type { Database } from "@/types/database";

export type DealStatus = Database["public"]["Enums"]["deal_status"];
export type DealSide = Database["public"]["Enums"]["deal_side"];

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

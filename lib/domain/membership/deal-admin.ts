import { z } from "zod";
import type { DealStatus } from "./status";

/** 운영자 거래 인박스 탭(A-05) */
export const DEAL_TABS = ["new", "mine", "open", "all"] as const;
export type DealTab = (typeof DEAL_TABS)[number];
export const DEAL_TAB_LABEL: Record<DealTab, string> = { new: "신규 상담", mine: "내 담당", open: "진행 중", all: "전체" };
export const DEAL_OPEN_STATUSES = [
  "inquiry", "negotiating", "contract_scheduled", "contracted", "transferring",
] as const satisfies readonly DealStatus[];

export function parseDealTab(v: string | string[] | undefined): DealTab {
  const s = Array.isArray(v) ? v[0] : v;
  return (DEAL_TABS as readonly string[]).includes(s ?? "") ? (s as DealTab) : "new";
}

/** 진행 순서. advance_deal은 한 칸씩 전진만 허용한다 */
export const DEAL_FLOW = ["inquiry", "negotiating", "contract_scheduled", "contracted", "transferring", "completed"] as const;

export function nextDealStatus(status: DealStatus): DealStatus | null {
  if (status === "inquiry") return null; // inquiry → negotiating은 start_deal
  const i = (DEAL_FLOW as readonly string[]).indexOf(status);
  return i >= 0 && i < DEAL_FLOW.length - 1 ? DEAL_FLOW[i + 1]! : null;
}

/** 다음 단계로 가기 전에 필요한 조건(DB advance_deal과 같다) */
export function advanceBlocker(next: DealStatus, deal: { contract_date: string | null; agreed_price: number | null }): string | null {
  if (next === "contract_scheduled" && !deal.contract_date) return "계약일을 먼저 저장해 주세요.";
  if (next === "contracted" && deal.agreed_price == null) return "합의가를 먼저 저장해 주세요.";
  return null;
}

/** 운영자 버튼 노출. 조건 수정·단계 진행은 담당자 또는 owner(D-15), 배정·시작·취소는 모든 운영자 */
export function dealAdminActions(status: DealStatus, opts: { isAssignee: boolean; isOwner: boolean }) {
  const open = (DEAL_OPEN_STATUSES as readonly DealStatus[]).includes(status);
  const owns = opts.isAssignee || opts.isOwner;
  return {
    canAssign: open,
    canStart: status === "inquiry",
    canEditTerms: open && status !== "inquiry" && owns,
    canAdvance: nextDealStatus(status) !== null && owns,
    canCancel: open,
  };
}

const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? null : Number(s);
};
const uuid = z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });
const version = z.preprocess(toNumber, z.number().int().min(1));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const dealRefSchema = z.object({ dealId: uuid, expectedVersion: version });
export const assignDealSchema = dealRefSchema.extend({ assigneeId: uuid });
export const advanceDealSchema = dealRefSchema.extend({
  toStatus: z.enum(["contract_scheduled", "contracted", "transferring", "completed"]),
});
export const dealTermsSchema = dealRefSchema.extend({
  agreedPrice: z.preprocess(
    toNumber,
    z.number({ error: "숫자로 입력해 주세요." }).int("원 단위 정수로 입력해 주세요.").positive("0원보다 커야 합니다.")
      .max(100_000_000_000, "금액을 확인해 주세요.").nullable(),
  ),
  contractDate: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().regex(DATE_RE, "날짜 형식을 확인해 주세요.").nullable(),
  ),
});
export const cancelDealAdminSchema = dealRefSchema.extend({
  reason: z.string({ error: "사유를 입력해 주세요." }).trim().min(1, "사유를 입력해 주세요.").max(500, "사유는 500자 이내로 입력해 주세요."),
});

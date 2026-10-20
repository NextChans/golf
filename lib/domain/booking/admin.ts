import { z } from "zod";
import type { BookingStatus } from "./status";

/** 운영자 인박스 탭(A-01) */
export const INBOX_TABS = ["new", "mine", "sla", "open", "all"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];
export const INBOX_TAB_LABEL: Record<InboxTab, string> = {
  new: "신규",
  mine: "내 담당",
  sla: "SLA 초과",
  open: "진행 중",
  all: "전체",
};
export const OPEN_STATUSES = ["requested", "in_review", "proposed"] as const satisfies readonly BookingStatus[];

export function parseInboxTab(v: string | string[] | undefined): InboxTab {
  const s = Array.isArray(v) ? v[0] : v;
  return (INBOX_TABS as readonly string[]).includes(s ?? "") ? (s as InboxTab) : "new";
}

/**
 * 운영자 버튼 노출. DB 함수의 허용 상태와 맞춘다(assign/propose/reject/cancel_booking).
 * 제안은 담당자 또는 owner만 가능(propose_booking).
 */
export function adminActions(status: BookingStatus, opts: { isAssignee: boolean; isOwner: boolean }) {
  const open = (OPEN_STATUSES as readonly BookingStatus[]).includes(status);
  return {
    canAssign: open,
    canPropose: (status === "in_review" || status === "proposed") && (opts.isAssignee || opts.isOwner),
    canReject: open,
    canCancel: open || status === "confirmed",
  };
}

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** datetime-local 값(KST로 입력) → ISO 문자열(+09:00). KST는 서머타임이 없다 */
export function kstLocalToIso(local: string): string | null {
  const m = LOCAL_DT_RE.exec(local);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // 2026-02-31 같은 값은 Date가 넘겨 계산하므로 되돌려 비교해 거부한다
  const back = new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
  return back === local ? iso : null;
}

/** ISO → datetime-local 기본값(KST) */
export function isoToKstLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16);
}

const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? undefined : Number(s);
};
const uuid = z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });
const version = z.preprocess(toNumber, z.number().int().min(1));
const requiredReason = z
  .string({ error: "사유를 입력해 주세요." })
  .trim()
  .min(1, "사유를 입력해 주세요.")
  .max(500, "사유는 500자 이내로 입력해 주세요.");

export const assignSchema = z.object({ requestId: uuid, assigneeId: uuid, expectedVersion: version });

export function makeProposeSchema(now: Date = new Date()) {
  return z.object({
    requestId: uuid,
    expectedVersion: version,
    teeTime: z
      .string({ error: "티타임을 입력해 주세요." })
      .transform((v, ctx) => {
        const iso = kstLocalToIso(v);
        if (!iso) {
          ctx.addIssue({ code: "custom", message: "티타임 형식을 확인해 주세요." });
          return z.NEVER;
        }
        if (Date.parse(iso) <= now.getTime()) {
          ctx.addIssue({ code: "custom", message: "지금 이후 시각을 입력해 주세요." });
          return z.NEVER;
        }
        return iso;
      }),
    greenFeePerPerson: z.preprocess(
      toNumber,
      z
        .number({ error: "1인 그린피를 입력해 주세요." })
        .int("원 단위 정수로 입력해 주세요.")
        .min(0, "0원 이상으로 입력해 주세요.")
        .max(10_000_000, "1,000만 원 이하로 입력해 주세요."),
    ),
    validMinutes: z.preprocess(
      toNumber,
      z.number().int().min(30, "유효시간은 30분~24시간입니다.").max(1440, "유효시간은 30분~24시간입니다.").default(120),
    ),
    memo: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(500, "메모는 500자 이내로 입력해 주세요.").optional(),
    ),
  });
}

export const rejectSchema = z.object({ requestId: uuid, expectedVersion: version, reason: requiredReason });
export const adminCancelSchema = rejectSchema;

/** zod 이슈 → 필드별 첫 메시지 */
export function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

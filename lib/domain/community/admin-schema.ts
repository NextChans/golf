import { z } from "zod";
import type { Database } from "@/types/database";

/** 운영자 커뮤니티 관리(M7). 고객 화면 라벨(schema/labels.ts)과 독립적으로 둔다 */
type Enums = Database["public"]["Enums"];
export type GroupType = Enums["group_type"];
export type GroupStatus = Enums["group_status"];
export type ReportReason = Enums["report_reason"];
export type ReportTarget = Enums["report_target"];

export const COMMUNITY_TABS = ["reports", "review", "groups"] as const;
export type CommunityTab = (typeof COMMUNITY_TABS)[number];
export const COMMUNITY_TAB_LABEL: Record<CommunityTab, string> = { reports: "신고", review: "검수 대기", groups: "모임 전체" };

export function parseCommunityTab(v: string | string[] | undefined): CommunityTab {
  const s = Array.isArray(v) ? v[0] : v;
  return (COMMUNITY_TABS as readonly string[]).includes(s ?? "") ? (s as CommunityTab) : "reports";
}

export const ADMIN_REPORT_REASON_LABEL: Record<ReportReason, string> = {
  not_golf: "골프와 무관한 모임",
  spam: "광고·도배",
  abuse: "욕설·괴롭힘",
  illegal: "불법·사기",
  other: "기타",
};
export const ADMIN_REPORT_TARGET_LABEL: Record<ReportTarget, string> = { group: "모임", post: "게시글", user: "회원" };
export const ADMIN_GROUP_TYPE_LABEL: Record<GroupType, string> = {
  round: "지역 라운딩",
  screen: "스크린골프",
  practice: "레슨·연습",
  join: "조인·동반자 모집",
  level: "구력·핸디캡별",
  membership: "회원권 보유자",
};
export const ADMIN_GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  active: "공개",
  review: "검수 대기",
  hidden: "비공개",
  closed: "종료",
};

/** 운영자가 고를 수 있는 모임 상태 버튼(moderate_group은 active·hidden만, closed는 불가) */
export function groupModerationActions(status: GroupStatus): { canApprove: boolean; canHide: boolean; canRestore: boolean } {
  return {
    canApprove: status === "review",
    canHide: status === "active" || status === "review",
    canRestore: status === "hidden",
  };
}

/** 게시글 본문 미리보기(줄바꿈을 공백으로, 최대 n자) */
export function excerpt(text: string | null | undefined, n = 120): string {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

const uuid = z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });

export const moderateGroupSchema = z
  .object({
    groupId: uuid,
    status: z.enum(["active", "hidden"]),
    reason: z.preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null),
      z.string().max(300, "사유는 300자 이내로 입력해 주세요.").nullable(),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.status === "hidden" && !v.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "비공개 사유를 입력해 주세요." });
    }
  });

export const moderatePostSchema = z.object({ postId: uuid, hidden: z.boolean() });

export const resolveReportSchema = z.object({
  reportId: z.number().int().positive(),
  status: z.enum(["resolved", "dismissed"]),
});

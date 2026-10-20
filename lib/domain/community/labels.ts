import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type GroupType = Enums["group_type"];
export type GroupJoinPolicy = Enums["group_join_policy"];
export type GroupStatus = Enums["group_status"];
export type GroupRole = Enums["group_role"];
export type GroupMemberStatus = Enums["group_member_status"];
export type ReportTarget = Enums["report_target"];
export type ReportReason = Enums["report_reason"];

/** 모임 유형(public.group_type). 골프 관련 모임만 허용한다(D-67) — DB enum 순서와 맞춘다 */
export const GROUP_TYPES = ["round", "screen", "practice", "join", "level", "membership"] as const satisfies readonly GroupType[];
export const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  round: "지역 라운딩",
  screen: "스크린골프",
  practice: "레슨·연습",
  join: "조인·동반자 모집",
  level: "구력·핸디캡별",
  membership: "회원권 보유자",
};

export const JOIN_POLICIES = ["open", "approval"] as const satisfies readonly GroupJoinPolicy[];
export const JOIN_POLICY_LABEL: Record<GroupJoinPolicy, string> = {
  open: "바로 가입",
  approval: "승인 후 가입",
};

export const GROUP_ROLES = ["owner", "manager", "member"] as const satisfies readonly GroupRole[];
export const GROUP_ROLE_LABEL: Record<GroupRole, string> = {
  owner: "모임장",
  manager: "운영진",
  member: "멤버",
};

/** 활성(active)이 아닌 모임의 상태 배지 */
export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  active: "운영 중",
  review: "검수 대기",
  hidden: "비공개",
  closed: "종료",
};

export const REPORT_TARGETS = ["group", "post", "user"] as const satisfies readonly ReportTarget[];
export const REPORT_REASONS = ["not_golf", "spam", "abuse", "illegal", "other"] as const satisfies readonly ReportReason[];
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  not_golf: "골프와 무관한 모임",
  spam: "광고·도배",
  abuse: "욕설·괴롭힘",
  illegal: "불법·사기",
  other: "기타",
};

/** 모임장·운영진(정모 개설·가입 승인·공지 등) */
export const isGroupManager = (role: GroupRole | null | undefined): boolean => role === "owner" || role === "manager";

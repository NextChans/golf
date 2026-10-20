import { describe, expect, it } from "vitest";
import {
  ADMIN_GROUP_STATUS_LABEL,
  ADMIN_GROUP_TYPE_LABEL,
  ADMIN_REPORT_REASON_LABEL,
  excerpt,
  groupModerationActions,
  moderateGroupSchema,
  moderatePostSchema,
  parseCommunityTab,
  resolveReportSchema,
} from "./admin-schema";

const GROUP = "00000000-0000-4000-a000-000000000301";

describe("parseCommunityTab", () => {
  it("알 수 없는 값·배열·없음은 신고 탭", () => {
    expect(parseCommunityTab(undefined)).toBe("reports");
    expect(parseCommunityTab("nope")).toBe("reports");
    expect(parseCommunityTab(["review", "groups"])).toBe("review");
    expect(parseCommunityTab("groups")).toBe("groups");
  });
});

describe("labels", () => {
  it("DB enum 값마다 라벨이 있다", () => {
    expect(Object.values(ADMIN_REPORT_REASON_LABEL)).toEqual(["골프와 무관한 모임", "광고·도배", "욕설·괴롭힘", "불법·사기", "기타"]);
    expect(Object.keys(ADMIN_GROUP_TYPE_LABEL)).toEqual(["round", "screen", "practice", "join", "level", "membership"]);
    expect(ADMIN_GROUP_STATUS_LABEL).toEqual({ active: "공개", review: "검수 대기", hidden: "비공개", closed: "종료" });
  });
});

describe("groupModerationActions", () => {
  it("상태별 버튼", () => {
    expect(groupModerationActions("review")).toEqual({ canApprove: true, canHide: true, canRestore: false });
    expect(groupModerationActions("active")).toEqual({ canApprove: false, canHide: true, canRestore: false });
    expect(groupModerationActions("hidden")).toEqual({ canApprove: false, canHide: false, canRestore: true });
    expect(groupModerationActions("closed")).toEqual({ canApprove: false, canHide: false, canRestore: false });
  });
});

describe("excerpt", () => {
  it("공백을 접고 길면 자른다", () => {
    expect(excerpt("  가\n\n나  ")).toBe("가 나");
    expect(excerpt("a".repeat(130), 120)).toBe(`${"a".repeat(120)}…`);
    expect(excerpt(null)).toBe("");
  });
});

describe("moderateGroupSchema", () => {
  it("공개 승인은 사유 선택, 빈 문자열은 null", () => {
    expect(moderateGroupSchema.parse({ groupId: GROUP, status: "active", reason: "  " })).toEqual({ groupId: GROUP, status: "active", reason: null });
    expect(moderateGroupSchema.parse({ groupId: GROUP, status: "active" }).reason).toBeNull();
  });
  it("비공개는 사유 필수, 300자 제한", () => {
    const r = moderateGroupSchema.safeParse({ groupId: GROUP, status: "hidden", reason: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("비공개 사유를 입력해 주세요.");
    expect(moderateGroupSchema.safeParse({ groupId: GROUP, status: "hidden", reason: "가".repeat(301) }).success).toBe(false);
    expect(moderateGroupSchema.parse({ groupId: GROUP, status: "hidden", reason: " 골프 무관 " }).reason).toBe("골프 무관");
  });
  it("closed·review로는 바꿀 수 없고 uuid가 아니면 거부", () => {
    expect(moderateGroupSchema.safeParse({ groupId: GROUP, status: "closed", reason: "x" }).success).toBe(false);
    expect(moderateGroupSchema.safeParse({ groupId: GROUP, status: "review" }).success).toBe(false);
    expect(moderateGroupSchema.safeParse({ groupId: "abc", status: "active" }).success).toBe(false);
  });
});

describe("moderatePostSchema · resolveReportSchema", () => {
  it("형식 검증", () => {
    expect(moderatePostSchema.safeParse({ postId: GROUP, hidden: true }).success).toBe(true);
    expect(moderatePostSchema.safeParse({ postId: GROUP, hidden: "true" }).success).toBe(false);
    expect(resolveReportSchema.safeParse({ reportId: 3, status: "resolved" }).success).toBe(true);
    expect(resolveReportSchema.safeParse({ reportId: 3, status: "open" }).success).toBe(false);
    expect(resolveReportSchema.safeParse({ reportId: 0, status: "dismissed" }).success).toBe(false);
  });
});

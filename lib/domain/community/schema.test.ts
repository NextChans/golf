import { describe, expect, it } from "vitest";
import {
  createGroupSchema, createPostSchema, formatMeetingFee, makeMeetingSchema, parseCreateGroupForm,
  parseGroupFilters, parseMeetingForm, reportSchema, updateGroupSchema,
} from "./schema";
import { GROUP_TYPE_LABEL, GROUP_TYPES, isGroupManager, REPORT_REASON_LABEL, REPORT_REASONS } from "./labels";

const KEY = "6f1c3a52-8f3e-4b8a-9c1d-2e5f7a9b0c11";
const GROUP = "00000000-0000-4000-d000-000000000001";
const COURSE = "00000000-0000-4000-a000-000000000001";
// UTC 15:30 = KST 2026-10-21 00:30
const NOW = new Date("2026-10-20T15:30:00Z");

const group = {
  idempotencyKey: KEY, name: "강남 주말 라운딩", type: "round", region: "seoul_gyeonggi",
  description: "주말마다 수도권 골프장에서 라운딩합니다.", joinPolicy: null, capacity: null, openChatUrl: null,
};
const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join("."));

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("labels", () => {
  it("모든 enum 값에 라벨이 있다", () => {
    for (const t of GROUP_TYPES) expect(GROUP_TYPE_LABEL[t]).toBeTruthy();
    for (const r of REPORT_REASONS) expect(REPORT_REASON_LABEL[r]).toBeTruthy();
    expect(GROUP_TYPE_LABEL.join).toBe("조인·동반자 모집");
  });
  it("isGroupManager", () => {
    expect(isGroupManager("owner")).toBe(true);
    expect(isGroupManager("manager")).toBe(true);
    expect(isGroupManager("member")).toBe(false);
    expect(isGroupManager(null)).toBe(false);
  });
});

describe("createGroupSchema", () => {
  it("기본값: 승인제, 정원 100, 오픈채팅 없음", () => {
    const r = createGroupSchema.safeParse(group);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.joinPolicy).toBe("approval");
      expect(r.data.capacity).toBe(100);
      expect(r.data.openChatUrl).toBeNull();
    }
  });
  it("이름 2~40자, 소개 10~2000자(앞뒤 공백 제외)", () => {
    expect(paths(createGroupSchema.safeParse({ ...group, name: " 가 " }))).toEqual(["name"]);
    expect(paths(createGroupSchema.safeParse({ ...group, name: "가".repeat(41) }))).toEqual(["name"]);
    expect(createGroupSchema.safeParse({ ...group, name: "가".repeat(40) }).success).toBe(true);
    expect(paths(createGroupSchema.safeParse({ ...group, description: "짧은 소개" }))).toEqual(["description"]);
    expect(paths(createGroupSchema.safeParse({ ...group, description: "가".repeat(2001) }))).toEqual(["description"]);
  });
  it("유형·지역은 필수이고 enum 값만", () => {
    expect(paths(createGroupSchema.safeParse({ ...group, type: null }))).toEqual(["type"]);
    expect(paths(createGroupSchema.safeParse({ ...group, type: "dating" }))).toEqual(["type"]);
    expect(paths(createGroupSchema.safeParse({ ...group, region: "busan" }))).toEqual(["region"]);
  });
  it("정원 2~300", () => {
    expect(paths(createGroupSchema.safeParse({ ...group, capacity: "1" }))).toEqual(["capacity"]);
    expect(paths(createGroupSchema.safeParse({ ...group, capacity: "301" }))).toEqual(["capacity"]);
    expect(paths(createGroupSchema.safeParse({ ...group, capacity: "abc" }))).toEqual(["capacity"]);
    const r = createGroupSchema.safeParse({ ...group, capacity: "2" });
    expect(r.success && r.data.capacity).toBe(2);
  });
  it("오픈채팅은 https://open.kakao.com/ 링크만", () => {
    expect(createGroupSchema.safeParse({ ...group, openChatUrl: "https://open.kakao.com/o/abc" }).success).toBe(true);
    expect(paths(createGroupSchema.safeParse({ ...group, openChatUrl: "http://open.kakao.com/o/abc" }))).toEqual(["openChatUrl"]);
    expect(paths(createGroupSchema.safeParse({ ...group, openChatUrl: "https://evil.example/o" }))).toEqual(["openChatUrl"]);
    expect(paths(createGroupSchema.safeParse({ ...group, openChatUrl: "https://open.kakao.com/" }))).toEqual(["openChatUrl"]);
  });
  it("FormData 파싱: 빈 값은 기본값", () => {
    const r = parseCreateGroupForm(form({
      idempotencyKey: KEY, name: "스크린 번개", type: "screen", region: "jeju",
      description: "제주 스크린골프 함께 쳐요.", joinPolicy: "open", capacity: "", openChatUrl: " ",
    }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ joinPolicy: "open", capacity: 100, openChatUrl: null });
  });
  it("멱등키가 없으면 거부", () => {
    expect(paths(createGroupSchema.safeParse({ ...group, idempotencyKey: null }))).toEqual(["idempotencyKey"]);
  });
});

describe("updateGroupSchema", () => {
  it("groupId·expectedVersion 필수", () => {
    const base = { ...group, groupId: GROUP, expectedVersion: "3" };
    const r = updateGroupSchema.safeParse(base);
    expect(r.success && r.data.expectedVersion).toBe(3);
    expect(paths(updateGroupSchema.safeParse({ ...base, expectedVersion: "0" }))).toEqual(["expectedVersion"]);
    expect(paths(updateGroupSchema.safeParse({ ...base, groupId: "x" }))).toEqual(["groupId"]);
  });
});

describe("makeMeetingSchema", () => {
  const schema = makeMeetingSchema(NOW);
  const base = {
    groupId: GROUP, title: "10월 정모", startsAt: "2026-10-25T07:30", placeKind: "course", golfCourseId: COURSE,
    placeFree: null, capacity: null, feePerPerson: null, note: null,
  };
  it("KST 입력을 +09:00 ISO로, 정원 기본 4", () => {
    const r = schema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startsAt).toBe("2026-10-25T07:30:00+09:00");
      expect(r.data.capacity).toBe(4);
      expect(r.data.feePerPerson).toBeNull();
    }
  });
  it("과거·180일 초과·형식 오류 거부", () => {
    // KST 2026-10-21 00:00은 NOW(00:30)보다 이전
    expect(paths(schema.safeParse({ ...base, startsAt: "2026-10-21T00:00" }))).toEqual(["startsAt"]);
    expect(paths(schema.safeParse({ ...base, startsAt: "2027-05-01T07:00" }))).toEqual(["startsAt"]);
    expect(paths(schema.safeParse({ ...base, startsAt: "2026-02-31T07:00" }))).toEqual(["startsAt"]);
  });
  it("장소: 골프장이면 골프장 필수, 자유 입력이면 장소 필수, 다른 쪽은 null", () => {
    expect(paths(schema.safeParse({ ...base, golfCourseId: null }))).toEqual(["golfCourseId"]);
    expect(paths(schema.safeParse({ ...base, placeKind: "free" }))).toEqual(["placeFree"]);
    const r = schema.safeParse({ ...base, placeKind: "free", placeFree: " 강남 스크린 " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ golfCourseId: null, placeFree: "강남 스크린" });
    const c = schema.safeParse({ ...base, placeFree: "무시됨" });
    expect(c.success && c.data.placeFree).toBeNull();
  });
  it("정원 2~100, 회비 0원 이상 정수(쉼표 허용)", () => {
    expect(paths(schema.safeParse({ ...base, capacity: "1" }))).toEqual(["capacity"]);
    expect(paths(schema.safeParse({ ...base, capacity: "101" }))).toEqual(["capacity"]);
    expect(paths(schema.safeParse({ ...base, feePerPerson: "-1" }))).toEqual(["feePerPerson"]);
    expect(paths(schema.safeParse({ ...base, feePerPerson: "1.5" }))).toEqual(["feePerPerson"]);
    const r = schema.safeParse({ ...base, feePerPerson: "30,000" });
    expect(r.success && r.data.feePerPerson).toBe(30000);
  });
  it("FormData 파싱", () => {
    const r = parseMeetingForm(form({
      groupId: GROUP, title: "스크린 번개", startsAt: "2026-10-22T19:00", placeKind: "free", placeFree: "역삼 스크린",
      capacity: "2", feePerPerson: "", note: "",
    }), NOW);
    expect(r.success).toBe(true);
  });
});

describe("createPostSchema / reportSchema", () => {
  it("공지 체크박스", () => {
    const r = createPostSchema.safeParse({ groupId: GROUP, title: "공지", body: "내용", isNotice: "on" });
    expect(r.success && r.data.isNotice).toBe(true);
    const n = createPostSchema.safeParse({ groupId: GROUP, title: "글", body: "내용", isNotice: null });
    expect(n.success && n.data.isNotice).toBe(false);
    expect(paths(createPostSchema.safeParse({ groupId: GROUP, title: " ", body: "x", isNotice: null }))).toEqual(["title"]);
    expect(paths(createPostSchema.safeParse({ groupId: GROUP, title: "a".repeat(81), body: "x", isNotice: null }))).toEqual(["title"]);
  });
  it("신고: 대상·사유 enum, 상세 500자", () => {
    const base = { targetType: "post", targetId: GROUP, reason: "spam", detail: null };
    expect(reportSchema.safeParse(base).success).toBe(true);
    expect(paths(reportSchema.safeParse({ ...base, reason: null }))).toEqual(["reason"]);
    expect(paths(reportSchema.safeParse({ ...base, targetType: "meeting" }))).toEqual(["targetType"]);
    expect(paths(reportSchema.safeParse({ ...base, detail: "a".repeat(501) }))).toEqual(["detail"]);
  });
});

describe("parseGroupFilters / formatMeetingFee", () => {
  it("알 수 없는 값은 무시", () => {
    expect(parseGroupFilters({ region: "jeju", type: "screen" })).toEqual({ region: "jeju", type: "screen" });
    expect(parseGroupFilters({ region: "mars", type: ["a", "b"] })).toEqual({ region: null, type: null });
  });
  it("회비 표시", () => {
    expect(formatMeetingFee(30000)).toBe("1인 30,000원(현장 정산)");
    expect(formatMeetingFee(0)).toBe("무료");
    expect(formatMeetingFee(null)).toBe("회비 없음");
  });
});

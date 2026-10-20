import { z } from "zod";
import { REGIONS } from "@/lib/domain/course/schema";
import { kstLocalToIso } from "@/lib/domain/booking/admin";
import { GROUP_ROLES, GROUP_TYPES, JOIN_POLICIES, REPORT_REASONS, REPORT_TARGETS } from "./labels";

/**
 * 골프 모임 커뮤니티(M7) 고객 입력. UX용 1차 검증이며 최종 판단(권한·정원·금칙어·상태)은 DB 함수가 한다.
 * 신뢰 경계: supabase/migrations/20261020000014_community.sql
 */

export const OPEN_CHAT_PREFIX = "https://open.kakao.com/";
export const MEETING_MAX_DAYS = 180;
/** 1인 회비 상한(원). 입력 실수 방지용(DB는 >= 0만 강제) */
export const MAX_MEETING_FEE = 10_000_000;

// ── 전처리 ──────────────────────────────────────────────
const emptyToNull = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v);
const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v === undefined ? null : v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? null : Number(s);
};
const toBool = (v: unknown) => v === true || v === "on" || v === "true";

const BAD_REQUEST = "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요.";
const NUMBER_MSG = "숫자로 입력해 주세요.";
const uuidSchema = z.uuid({ error: BAD_REQUEST });
// 행 id는 RFC variant를 강제하지 않는다(시드 id 등)
const idSchema = z.guid({ error: BAD_REQUEST });
const versionSchema = z.preprocess(toNumber, z.number({ error: BAD_REQUEST }).int().min(1));

const withDefault = <T>(fallback: T) => (v: unknown) => (emptyToNull(v) === null ? fallback : v);

const nameSchema = z
  .string({ error: "모임 이름을 입력해 주세요." })
  .trim()
  .min(2, "모임 이름은 2자 이상 입력해 주세요.")
  .max(40, "모임 이름은 40자 이내로 입력해 주세요.");
const descriptionSchema = z
  .string({ error: "모임 소개를 입력해 주세요." })
  .trim()
  .min(10, "모임 소개는 10자 이상 입력해 주세요.")
  .max(2000, "모임 소개는 2,000자 이내로 입력해 주세요.");
const regionSchema = z.enum(REGIONS, { error: "지역을 선택해 주세요." });
const joinPolicySchema = z.preprocess(withDefault("approval"), z.enum(JOIN_POLICIES, { error: "가입 방식을 선택해 주세요." }));
const groupCapacitySchema = z.preprocess(
  (v) => toNumber(withDefault("100")(v)),
  z.number({ error: NUMBER_MSG }).int(NUMBER_MSG).min(2, "정원은 2명 이상으로 입력해 주세요.").max(300, "정원은 300명 이하로 입력해 주세요."),
);
const openChatSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(200, "오픈채팅 링크가 너무 깁니다.")
    .refine((v) => v.startsWith(OPEN_CHAT_PREFIX) && v.length > OPEN_CHAT_PREFIX.length, {
      message: "카카오톡 오픈채팅 링크(https://open.kakao.com/…)만 입력할 수 있습니다.",
    })
    .nullable(),
);

/** 모임 만들기 */
export const createGroupSchema = z.object({
  idempotencyKey: uuidSchema,
  name: nameSchema,
  type: z.enum(GROUP_TYPES, { error: "모임 유형을 선택해 주세요." }),
  region: regionSchema,
  description: descriptionSchema,
  joinPolicy: joinPolicySchema,
  capacity: groupCapacitySchema,
  openChatUrl: openChatSchema,
});

/** 모임 정보 수정(유형은 바꾸지 않는다 — update_group 인자에 없음) */
export const updateGroupSchema = z.object({
  groupId: idSchema,
  expectedVersion: versionSchema,
  name: nameSchema,
  region: regionSchema,
  description: descriptionSchema,
  joinPolicy: joinPolicySchema,
  capacity: groupCapacitySchema,
  openChatUrl: openChatSchema,
});

export type CreateGroupInput = z.output<typeof createGroupSchema>;
export type UpdateGroupInput = z.output<typeof updateGroupSchema>;

// ── 가입·멤버 관리 ────────────────────────────────────────
export const joinGroupSchema = z.object({
  groupId: idSchema,
  message: z.preprocess(emptyToNull, z.string().trim().max(200, "인사말은 200자 이내로 입력해 주세요.").nullable()),
});
export const groupIdSchema = z.object({ groupId: idSchema });
export const memberTargetSchema = z.object({ groupId: idSchema, userId: idSchema });
export const decideJoinSchema = memberTargetSchema.extend({ approve: z.boolean() });
export const setMemberRoleSchema = memberTargetSchema.extend({ role: z.enum(GROUP_ROLES) });

// ── 정모 ────────────────────────────────────────────────
export const PLACE_KINDS = ["course", "free"] as const;

/** 정모 개설. 일시는 datetime-local(KST) → ISO(+09:00). now는 테스트에서 주입한다 */
export function makeMeetingSchema(now: Date = new Date()) {
  return z
    .object({
      groupId: idSchema,
      title: z
        .string({ error: "정모 이름을 입력해 주세요." })
        .trim()
        .min(2, "정모 이름은 2자 이상 입력해 주세요.")
        .max(60, "정모 이름은 60자 이내로 입력해 주세요."),
      startsAt: z.string({ error: "일시를 입력해 주세요." }).transform((v, ctx) => {
        const iso = kstLocalToIso(v);
        if (!iso) {
          ctx.addIssue({ code: "custom", message: "일시 형식을 확인해 주세요." });
          return z.NEVER;
        }
        const t = Date.parse(iso);
        if (t <= now.getTime()) {
          ctx.addIssue({ code: "custom", message: "지금 이후 시각을 입력해 주세요." });
          return z.NEVER;
        }
        if (t > now.getTime() + MEETING_MAX_DAYS * 86_400_000) {
          ctx.addIssue({ code: "custom", message: `${MEETING_MAX_DAYS}일 이내 일정만 만들 수 있습니다.` });
          return z.NEVER;
        }
        return iso;
      }),
      placeKind: z.enum(PLACE_KINDS, { error: "장소 종류를 선택해 주세요." }),
      golfCourseId: z.preprocess(emptyToNull, z.guid({ error: "골프장을 선택해 주세요." }).nullable()),
      placeFree: z.preprocess(emptyToNull, z.string().trim().max(100, "장소는 100자 이내로 입력해 주세요.").nullable()),
      capacity: z.preprocess(
        (v) => toNumber(withDefault("4")(v)),
        z.number({ error: NUMBER_MSG }).int(NUMBER_MSG).min(2, "정원은 2명 이상으로 입력해 주세요.").max(100, "정원은 100명 이하로 입력해 주세요."),
      ),
      feePerPerson: z.preprocess(
        toNumber,
        z
          .number({ error: NUMBER_MSG })
          .int("원 단위 정수로 입력해 주세요.")
          .min(0, "0원 이상으로 입력해 주세요.")
          .max(MAX_MEETING_FEE, "회비를 확인해 주세요.")
          .nullable(),
      ),
      note: z.preprocess(emptyToNull, z.string().trim().max(1000, "안내는 1,000자 이내로 입력해 주세요.").nullable()),
    })
    .superRefine((v, ctx) => {
      if (v.placeKind === "course" && !v.golfCourseId) {
        ctx.addIssue({ code: "custom", path: ["golfCourseId"], message: "골프장을 선택해 주세요." });
      }
      if (v.placeKind === "free" && !v.placeFree) {
        ctx.addIssue({ code: "custom", path: ["placeFree"], message: "장소를 입력해 주세요." });
      }
    })
    .transform((v) => ({
      ...v,
      // DB 제약(meeting_place_xor): 골프장 또는 자유 입력 중 하나만
      golfCourseId: v.placeKind === "course" ? v.golfCourseId : null,
      placeFree: v.placeKind === "free" ? v.placeFree : null,
    }));
}
export type MeetingInput = z.output<ReturnType<typeof makeMeetingSchema>>;

export const meetingIdSchema = z.object({ meetingId: idSchema });
export const cancelMeetingSchema = z.object({
  meetingId: idSchema,
  reason: z.preprocess(emptyToNull, z.string().trim().max(300, "사유는 300자 이내로 입력해 주세요.").nullable()),
});

// ── 게시판 ──────────────────────────────────────────────
export const createPostSchema = z.object({
  groupId: idSchema,
  title: z.string({ error: "제목을 입력해 주세요." }).trim().min(1, "제목을 입력해 주세요.").max(80, "제목은 80자 이내로 입력해 주세요."),
  body: z.string({ error: "내용을 입력해 주세요." }).trim().min(1, "내용을 입력해 주세요.").max(5000, "내용은 5,000자 이내로 입력해 주세요."),
  isNotice: z.preprocess(toBool, z.boolean()),
});
export const postIdSchema = z.object({ postId: idSchema });
export const pinPostSchema = z.object({ postId: idSchema, pinned: z.boolean() });

// ── 신고 ────────────────────────────────────────────────
export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS, { error: BAD_REQUEST }),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS, { error: "신고 사유를 선택해 주세요." }),
  detail: z.preprocess(emptyToNull, z.string().trim().max(500, "내용은 500자 이내로 입력해 주세요.").nullable()),
});

// ── FormData ────────────────────────────────────────────
function formRecord(formData: FormData, fields: readonly string[]): Record<string, string | null> {
  const raw: Record<string, string | null> = {};
  for (const key of fields) {
    const v = formData.get(key);
    raw[key] = typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return raw;
}

export const parseCreateGroupForm = (fd: FormData) =>
  createGroupSchema.safeParse(
    formRecord(fd, ["idempotencyKey", "name", "type", "region", "description", "joinPolicy", "capacity", "openChatUrl"]),
  );
export const parseUpdateGroupForm = (fd: FormData) =>
  updateGroupSchema.safeParse(
    formRecord(fd, ["groupId", "expectedVersion", "name", "region", "description", "joinPolicy", "capacity", "openChatUrl"]),
  );
export const parseMeetingForm = (fd: FormData, now: Date = new Date()) =>
  makeMeetingSchema(now).safeParse(
    formRecord(fd, ["groupId", "title", "startsAt", "placeKind", "golfCourseId", "placeFree", "capacity", "feePerPerson", "note"]),
  );
export const parseCreatePostForm = (fd: FormData) =>
  createPostSchema.safeParse(formRecord(fd, ["groupId", "title", "body", "isNotice"]));
export const parseJoinForm = (fd: FormData) => joinGroupSchema.safeParse(formRecord(fd, ["groupId", "message"]));
export const parseReportForm = (fd: FormData) =>
  reportSchema.safeParse(formRecord(fd, ["targetType", "targetId", "reason", "detail"]));

/** zod issue → 필드별 첫 메시지 */
export function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** 목록 필터(searchParams). 알 수 없는 값은 무시한다 */
export function parseGroupFilters(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const region = REGIONS.find((r) => r === one("region")) ?? null;
  const type = GROUP_TYPES.find((t) => t === one("type")) ?? null;
  return { region, type };
}

/** "1인 30,000원(현장 정산)" / 회비 없음 */
export function formatMeetingFee(fee: number | null | undefined): string {
  if (fee === null || fee === undefined) return "회비 없음";
  if (fee === 0) return "무료";
  return `1인 ${fee.toLocaleString("ko-KR")}원(현장 정산)`;
}

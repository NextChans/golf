import { z } from "zod";

/** 시간대 선호. 1부 06:00~10:00, 2부 11:00~15:00 고정, range만 시간 지정(D-12) */
export const TIME_PREFS = ["part_1", "part_2", "range"] as const;
/** 요청 가능 기간: 오늘(KST)~180일 후. DB `create_booking_request`와 맞춘다 */
export const MAX_ADVANCE_DAYS = 180;

const RANGE_MIN = "05:00";
const RANGE_MAX = "18:00";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘 날짜(KST) "YYYY-MM-DD". KST는 서머타임이 없어 +9h 고정 */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD"에 days일을 더한다(달력 계산, 시간대 무관) */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── 전처리: 폼 문자열 → 값 ──────────────────────────────────
/** 빈 문자열·공백·undefined → null */
const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);
/** 숫자 문자열(쉼표 허용) → number. 빈 값은 null, 숫자가 아니면 NaN(→ 검증 실패) */
const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v === undefined ? null : v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? null : Number(s);
};

const NUMBER_MSG = "숫자로 입력해 주세요.";
const reasonSchema = z.preprocess(emptyToNull, z.string().trim().max(500, "사유는 500자 이내로 입력해 주세요.").nullable());
const versionSchema = z.preprocess(toNumber, z.number({ error: NUMBER_MSG }).int().min(1));
const uuidSchema = z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;
/** "HH:MM" 또는 "HH:MM:00" → "HH:MM" */
const timeSchema = z.preprocess(
  emptyToNull,
  z.string().regex(TIME_RE, "시간 형식을 확인해 주세요.").transform((v) => v.slice(0, 5)).nullable(),
);

const isRealDate = (v: string) => DATE_RE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** 부킹 요청 스키마. now를 주입할 수 있게 팩토리로 둔다(날짜 범위 테스트용) */
export function makeBookingRequestSchema(now: Date = new Date()) {
  return z
    .object({
      idempotencyKey: uuidSchema,
      golfCourseId: z.preprocess(emptyToNull, z.uuid({ error: "골프장을 다시 선택해 주세요." }).nullable()),
      courseNameFree: z.preprocess(
        emptyToNull,
        z.string().trim().min(1).max(100, "골프장 이름은 100자 이내로 입력해 주세요.").nullable(),
      ),
      playDate: z.string({ error: "날짜를 선택해 주세요." }).refine(isRealDate, "날짜 형식을 확인해 주세요."),
      timePref: z.enum(TIME_PREFS, { error: "시간대를 선택해 주세요." }),
      timeFrom: timeSchema,
      timeTo: timeSchema,
      players: z.preprocess(
        toNumber,
        z
          .number({ error: "인원을 선택해 주세요." })
          .int("인원을 선택해 주세요.")
          .min(1, "인원은 1~4명입니다.")
          .max(4, "인원은 1~4명입니다."),
      ),
      budgetPerPerson: z.preprocess(
        toNumber,
        z
          .number({ error: NUMBER_MSG })
          .int("원 단위 정수로 입력해 주세요.")
          .min(0, "0원 이상으로 입력해 주세요.")
          .max(10_000_000, "1인 예산은 1,000만 원 이하로 입력해 주세요.")
          .nullable(),
      ),
      note: z.preprocess(emptyToNull, z.string().trim().max(1000, "요청 사항은 1,000자 이내로 입력해 주세요.").nullable()),
    })
    .superRefine((v, ctx) => {
      // 골프장: 마스터 선택 또는 자유 입력 중 하나(D-14)
      if ((v.golfCourseId === null) === (v.courseNameFree === null)) {
        ctx.addIssue({ code: "custom", path: ["golfCourseId"], message: "골프장을 선택하거나 직접 입력해 주세요." });
      }

      // 날짜: 오늘(KST)~180일 후
      const today = todayKst(now);
      if (v.playDate < today) {
        ctx.addIssue({ code: "custom", path: ["playDate"], message: "오늘 이후 날짜를 선택해 주세요." });
      } else if (v.playDate > addDaysIso(today, MAX_ADVANCE_DAYS)) {
        ctx.addIssue({ code: "custom", path: ["playDate"], message: `${MAX_ADVANCE_DAYS}일 이내 날짜만 요청할 수 있습니다.` });
      }

      // 시간: range만 지정, 30분 단위, 05:00~18:00, 시작 < 종료
      if (v.timePref !== "range") {
        if (v.timeFrom !== null || v.timeTo !== null) {
          ctx.addIssue({ code: "custom", path: ["timeFrom"], message: "1부·2부는 시간을 따로 지정하지 않습니다." });
        }
        return;
      }
      for (const key of ["timeFrom", "timeTo"] as const) {
        const t = v[key];
        if (t === null) {
          ctx.addIssue({ code: "custom", path: [key], message: key === "timeFrom" ? "시작 시간을 선택해 주세요." : "종료 시간을 선택해 주세요." });
        } else if (!t.endsWith(":00") && !t.endsWith(":30")) {
          ctx.addIssue({ code: "custom", path: [key], message: "30분 단위로 선택해 주세요." });
        } else if (t < RANGE_MIN || t > RANGE_MAX) {
          ctx.addIssue({ code: "custom", path: [key], message: `${RANGE_MIN}~${RANGE_MAX} 사이로 선택해 주세요.` });
        }
      }
      if (v.timeFrom !== null && v.timeTo !== null && v.timeFrom >= v.timeTo) {
        ctx.addIssue({ code: "custom", path: ["timeTo"], message: "종료 시간은 시작 시간보다 늦어야 합니다." });
      }
    });
}

export const bookingRequestSchema = makeBookingRequestSchema();
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

const FORM_FIELDS = [
  "idempotencyKey", "golfCourseId", "courseNameFree", "playDate", "timePref",
  "timeFrom", "timeTo", "players", "budgetPerPerson", "note",
] as const;

/** FormData → 검증 결과. 빈 문자열은 null, 숫자·쉼표 금액은 스키마 전처리가 변환한다 */
export function parseBookingForm(formData: FormData, now: Date = new Date()): ReturnType<typeof bookingRequestSchema.safeParse> {
  const raw: Record<string, string | null> = {};
  for (const key of FORM_FIELDS) {
    const v = formData.get(key);
    raw[key] = typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return makeBookingRequestSchema(now).safeParse(raw);
}

export const acceptProposalSchema = z.object({
  idempotencyKey: uuidSchema,
  proposalId: uuidSchema,
  expectedVersion: versionSchema,
});

export const declineProposalSchema = z.object({
  proposalId: uuidSchema,
  expectedVersion: versionSchema,
  reason: reasonSchema,
});

export const cancelBookingSchema = z.object({
  requestId: uuidSchema,
  expectedVersion: versionSchema,
  reason: reasonSchema,
});

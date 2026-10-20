import { z } from "zod";
import { krMobileSchema } from "@/lib/domain/phone";

/** 통화 메모 대상(activity_notes.subject_type) */
export const NOTE_SUBJECT_TYPES = ["customer", "booking", "deal"] as const;
export type NoteSubjectType = (typeof NOTE_SUBJECT_TYPES)[number];
export const NOTE_SUBJECT_LABEL: Record<NoteSubjectType, string> = {
  customer: "고객",
  booking: "부킹",
  deal: "회원권",
};

export const NOTE_MAX = 2000;

const uuid = z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });

/** add_activity_note 입력. DB 함수가 최종 검증한다(신뢰 경계). customer가 아니면 subjectId 필수 */
export const activityNoteSchema = z
  .object({
    customerId: uuid,
    subjectType: z.enum(NOTE_SUBJECT_TYPES, { error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." }),
    subjectId: uuid.optional(),
    body: z
      .string({ error: "메모를 입력해 주세요." })
      .trim()
      .min(1, "메모를 입력해 주세요.")
      .max(NOTE_MAX, `메모는 ${NOTE_MAX.toLocaleString("ko-KR")}자 이내로 입력해 주세요.`),
  })
  .superRefine((v, ctx) => {
    if (v.subjectType !== "customer" && !v.subjectId) {
      ctx.addIssue({ code: "custom", path: ["subjectId"], message: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });
    }
  })
  .transform((v) => ({ ...v, subjectId: v.subjectType === "customer" ? undefined : v.subjectId }));

export type ActivityNoteInput = z.output<typeof activityNoteSchema>;

/** FormData → 스키마 입력. 빈 문자열은 없는 값으로 본다 */
export function parseActivityNoteForm(fd: FormData) {
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  return activityNoteSchema.safeParse({
    customerId: str("customerId"),
    subjectType: str("subjectType"),
    subjectId: str("subjectId"),
    body: fd.get("body") ?? undefined,
  });
}

/** 고객 검색어 해석(A-06): 숫자(하이픈·공백 허용)면 휴대폰 번호, 아니면 이름 */
export type CustomerQuery =
  | { kind: "none" }
  | { kind: "phone"; e164: string }
  | { kind: "invalid_phone" }
  | { kind: "name"; pattern: string };

/** ilike 패턴용 이스케이프(\, %, _) */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function parseCustomerQuery(raw: string | string[] | undefined): CustomerQuery {
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 50) ?? "";
  if (!q) return { kind: "none" };
  const compact = q.replace(/[\s-]/g, "");
  if (/^\+?\d+$/.test(compact)) {
    const local = compact.startsWith("+82") ? `0${compact.slice(3)}` : compact;
    const parsed = krMobileSchema.safeParse(local);
    return parsed.success ? { kind: "phone", e164: parsed.data } : { kind: "invalid_phone" };
  }
  return { kind: "name", pattern: `%${escapeLike(q)}%` };
}

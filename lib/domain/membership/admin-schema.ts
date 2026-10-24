import { z } from "zod";
import type { Database } from "@/types/database";
import { todayKst } from "@/lib/format/kst";

/** 회원권 마스터 관리(A-04) 폼 스키마. 최종 검증은 DB 함수(upsert_membership_product·upsert_listing·upsert_quote)가 한다 */

export type ListingStatus = Database["public"]["Enums"]["listing_status"];

/** 운영자 화면의 매물 상태 라벨 */
export const LISTING_STATUS_ADMIN_LABEL: Record<ListingStatus, string> = {
  hidden: "비공개",
  listed: "공개",
  reserved: "상담 중",
  sold: "판매완료",
};

/** 금액 상한(원). 입력 실수(0 하나 더)를 막는 UX 검증용이며 DB는 > 0(시세는 >= 0)만 강제한다 */
export const MAX_MEMBERSHIP_PRICE = 100_000_000_000;

const INVALID_ID = "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요.";

// ── 전처리: 폼 문자열 → 값 ──────────────────────────────────
const emptyToNull = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v);
/** "180,000" → 180000. 빈 값은 null, 숫자가 아니면 NaN(→ 검증 실패) */
const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v === undefined ? null : v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? null : Number(s);
};
const toBool = (v: unknown) => v === true || v === "on" || v === "true";

const optionalId = z.preprocess(emptyToNull, z.uuid({ error: INVALID_ID }).nullable());
const requiredId = (message: string) => z.uuid({ error: message });

const price = (min: number, minMessage: string, requiredMessage = "숫자로 입력해 주세요.") =>
  z
    .number({ error: (iss) => (iss.input === null || iss.input === undefined ? requiredMessage : "숫자로 입력해 주세요.") })
    .int("원 단위 정수로 입력해 주세요.")
    .min(min, minMessage)
    .max(MAX_MEMBERSHIP_PRICE, "금액을 확인해 주세요.");

// ── 상품 ─────────────────────────────────────────────────
export const productSchema = z.object({
  id: optionalId,
  golfCourseId: requiredId("골프장을 선택해 주세요."),
  kind: z.string({ error: "종류를 입력해 주세요." }).trim().min(1, "종류를 입력해 주세요.").max(30, "종류는 30자 이내로 입력해 주세요."),
  name: z.string({ error: "상품명을 입력해 주세요." }).trim().min(1, "상품명을 입력해 주세요.").max(100, "상품명은 100자 이내로 입력해 주세요."),
  isActive: z.preprocess(toBool, z.boolean()),
});
export type ProductInput = z.output<typeof productSchema>;

// ── 매물 ─────────────────────────────────────────────────
export const listingSchema = z.object({
  id: optionalId,
  productId: requiredId("상품을 선택해 주세요."),
  askingPrice: z.preprocess(toNumber, price(1, "호가는 1원 이상으로 입력해 주세요.", "호가를 입력해 주세요.")),
  description: z.preprocess(emptyToNull, z.string().trim().max(2000, "설명은 2000자 이내로 입력해 주세요.").nullable()),
});
export type ListingInput = z.output<typeof listingSchema>;

// ── 시세 ─────────────────────────────────────────────────
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** now를 받아 "미래 날짜 금지"를 KST 기준으로 판단한다(테스트에서 시각 고정) */
export const quoteSchemaAt = (now: Date = new Date()) =>
  z
    .object({
      productId: requiredId(INVALID_ID),
      quotedOn: z
        .string({ error: "기준일을 선택해 주세요." })
        .regex(ISO_DATE, "기준일을 선택해 주세요.")
        .refine(isRealDate, "기준일을 선택해 주세요.")
        .refine((d) => d <= todayKst(now), "오늘 이후 날짜는 입력할 수 없습니다."),
      buyPrice: z.preprocess(toNumber, price(0, "0원 이상으로 입력해 주세요.").nullable()),
      sellPrice: z.preprocess(toNumber, price(0, "0원 이상으로 입력해 주세요.").nullable()),
    })
    .superRefine((v, ctx) => {
      if (v.buyPrice === null && v.sellPrice === null) {
        ctx.addIssue({ code: "custom", path: ["buyPrice"], message: "매수 또는 매도 시세를 입력해 주세요." });
      }
    });
export type QuoteInput = z.output<ReturnType<typeof quoteSchemaAt>>;

export const visibilitySchema = z.object({
  listingId: requiredId(INVALID_ID),
  visible: z.enum(["true", "false"], { error: INVALID_ID }).transform((v) => v === "true"),
});

// ── FormData → 검증 결과 ────────────────────────────────────
function pick(formData: FormData, keys: readonly string[]) {
  const raw: Record<string, unknown> = {};
  for (const key of keys) {
    const v = formData.get(key);
    raw[key] = v === null ? undefined : v;
  }
  return raw;
}

export const parseProductForm = (fd: FormData) => productSchema.safeParse(pick(fd, ["id", "golfCourseId", "kind", "name", "isActive"]));
export const parseListingForm = (fd: FormData) =>
  listingSchema.safeParse(pick(fd, ["id", "productId", "askingPrice", "description"]));
export const parseQuoteForm = (fd: FormData, now: Date = new Date()) =>
  quoteSchemaAt(now).safeParse(pick(fd, ["productId", "quotedOn", "buyPrice", "sellPrice"]));
export const parseVisibilityForm = (fd: FormData) => visibilitySchema.safeParse(pick(fd, ["listingId", "visible"]));

/** zod 이슈 → 필드별 첫 메시지 */
export function toFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

import { z } from "zod";

/** 지역 enum(public.region)과 화면 라벨. DB enum 순서와 맞춘다 */
export const REGIONS = ["seoul_gyeonggi", "gangwon", "chungcheong", "jeolla", "gyeongsang", "jeju"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABEL: Record<Region, string> = {
  seoul_gyeonggi: "서울·경기",
  gangwon: "강원",
  chungcheong: "충청",
  jeolla: "전라",
  gyeongsang: "경상",
  jeju: "제주",
};

/** 그린피 상한(원). 입력 실수(0 하나 더)를 막는 UX 검증용이며 DB는 >= 0만 강제한다 */
export const MAX_GREEN_FEE = 10_000_000;

// ── 전처리: 폼 문자열 → 값 ──────────────────────────────────
const emptyToNull = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v);
/** "180,000" → 180000. 빈 값은 null, 숫자가 아니면 NaN(→ 검증 실패) */
const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v === undefined ? null : v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? null : Number(s);
};
/** 체크박스: "on"/"true"/true → true, 없음 → false */
const toBool = (v: unknown) => v === true || v === "on" || v === "true";

const optionalText = (max: number, message: string) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, message).nullable());

const feeSchema = z.preprocess(
  toNumber,
  z
    .number({ error: "숫자로 입력해 주세요." })
    .int("원 단위 정수로 입력해 주세요.")
    .min(0, "0원 이상으로 입력해 주세요.")
    .max(MAX_GREEN_FEE, "그린피를 확인해 주세요.")
    .nullable(),
);

/** 골프장 마스터 저장 스키마(A-03). 최종 검증은 DB(upsert_golf_course·check 제약)가 한다 */
export const courseSchema = z.object({
  id: z.preprocess(emptyToNull, z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." }).nullable()),
  name: z
    .string({ error: "이름을 입력해 주세요." })
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(100, "이름은 100자 이내로 입력해 주세요."),
  region: z.enum(REGIONS, { error: "지역을 선택해 주세요." }),
  address: optionalText(200, "주소는 200자 이내로 입력해 주세요."),
  weekdayGreenFee: feeSchema,
  weekendGreenFee: feeSchema,
  cancellationPolicy: optionalText(2000, "취소 규정은 2000자 이내로 입력해 주세요."),
  contactPhone: optionalText(30, "연락처는 30자 이내로 입력해 주세요."),
  isActive: z.preprocess(toBool, z.boolean()),
});

export type CourseInput = z.output<typeof courseSchema>;

const FIELDS = [
  "id", "name", "region", "address", "weekdayGreenFee", "weekendGreenFee", "cancellationPolicy", "contactPhone", "isActive",
] as const;

/** FormData → 스키마 검증 결과. 없는 필드는 undefined로 둔다(체크박스 미선택 = false) */
export function parseCourseForm(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const v = formData.get(key);
    raw[key] = v === null ? undefined : v;
  }
  return courseSchema.safeParse(raw);
}

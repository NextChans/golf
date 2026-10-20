import { z } from "zod";
import { REGIONS, type Region } from "@/lib/domain/course/schema";

/**
 * 회원권 고객 입력(F-04 필터, F-05 상담 신청). 최종 검증은 DB 함수(create_deal_inquiry·cancel_deal)가 한다.
 * 금액 단위: 상담 신청의 희망가는 원(쉼표 허용), 목록 필터(searchParams min·max)는 만원.
 */

/** 희망가 상한(원). 입력 실수(0 하나 더)를 막는 UX 검증용이며 DB는 > 0만 강제한다 */
export const MAX_DEAL_PRICE = 100_000_000_000; // 1,000억 원
export const MAN_WON = 10_000;

// ── 전처리 ──────────────────────────────────────────────
const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);
const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v === undefined ? null : v;
  const s = v.replace(/,/g, "").trim();
  return s === "" ? null : Number(s);
};

const NUMBER_MSG = "숫자로 입력해 주세요.";
const uuidSchema = z.uuid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });
// 행 id는 RFC variant를 강제하지 않는다(z.guid). 시드·수동 등록 id(예: ...-c000-...)도 DB에서는 유효한 uuid다.
const idSchema = z.guid({ error: "잘못된 요청입니다. 새로고침 후 다시 시도해 주세요." });
const versionSchema = z.preprocess(toNumber, z.number({ error: NUMBER_MSG }).int().min(1));
const reasonSchema = z.preprocess(emptyToNull, z.string().trim().max(500, "사유는 500자 이내로 입력해 주세요.").nullable());

const priceSchema = z.preprocess(
  toNumber,
  z
    .number({ error: NUMBER_MSG })
    .int("원 단위 정수로 입력해 주세요.")
    .min(1, "1원 이상으로 입력해 주세요.")
    .max(MAX_DEAL_PRICE, "희망가는 1,000억 원 이하로 입력해 주세요.")
    .nullable(),
);
const contactWindowSchema = z.preprocess(
  emptyToNull,
  z.string().trim().max(100, "연락 가능 시간은 100자 이내로 입력해 주세요.").nullable(),
);
const noteSchema = z.preprocess(
  emptyToNull,
  z.string().trim().max(1000, "요청사항은 1,000자 이내로 입력해 주세요.").nullable(),
);

/** 매수 상담(매물 기준) */
export const buyInquirySchema = z.object({
  idempotencyKey: uuidSchema,
  listingId: idSchema,
  desiredPrice: priceSchema,
  contactWindow: contactWindowSchema,
  note: noteSchema,
});

/** 매도 상담(상품 기준, 매물 없음 — D-18) */
export const sellInquirySchema = z.object({
  idempotencyKey: uuidSchema,
  productId: z.guid({ error: "회원권을 선택해 주세요." }),
  desiredPrice: priceSchema,
  contactWindow: contactWindowSchema,
  note: noteSchema,
});

export type BuyInquiryInput = z.output<typeof buyInquirySchema>;
export type SellInquiryInput = z.output<typeof sellInquirySchema>;

function formRecord(formData: FormData, fields: readonly string[]): Record<string, string | null> {
  const raw: Record<string, string | null> = {};
  for (const key of fields) {
    const v = formData.get(key);
    raw[key] = typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return raw;
}

export function parseBuyInquiryForm(formData: FormData) {
  return buyInquirySchema.safeParse(
    formRecord(formData, ["idempotencyKey", "listingId", "desiredPrice", "contactWindow", "note"]),
  );
}

export function parseSellInquiryForm(formData: FormData) {
  return sellInquirySchema.safeParse(
    formRecord(formData, ["idempotencyKey", "productId", "desiredPrice", "contactWindow", "note"]),
  );
}

export const cancelDealSchema = z.object({
  dealId: idSchema,
  expectedVersion: versionSchema,
  reason: reasonSchema,
});

// ── 매물 목록 필터(searchParams) ─────────────────────────
export const LISTING_SORTS = ["price_asc", "price_desc", "newest"] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export const LISTING_SORT_LABEL: Record<ListingSort, string> = {
  price_asc: "낮은 가격순",
  price_desc: "높은 가격순",
  newest: "최신 등록순",
};

export type ListingFilters = {
  region: Region | null;
  /** 만원 단위(입력 그대로, 화면 표시용) */
  minManWon: number | null;
  maxManWon: number | null;
  /** 원 단위(쿼리용) */
  minWon: number | null;
  maxWon: number | null;
  sort: ListingSort;
};

type SearchParamValue = string | string[] | undefined;
const first = (v: SearchParamValue) => (Array.isArray(v) ? v[0] : v);

/** 만원 문자열 → 양의 정수(만원). 비었거나 잘못된 값은 null(필터 무시) */
function parseManWon(v: SearchParamValue): number | null {
  const s = first(v)?.replace(/,/g, "").trim();
  if (!s || !/^\d{1,8}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/**
 * URL 검색 조건을 해석한다. 잘못된 값은 오류 대신 무시한다(공유된 URL이 깨지지 않게).
 * 최소 > 최대로 들어오면 둘을 바꾼다.
 */
export function parseListingFilters(params: Record<string, SearchParamValue>): ListingFilters {
  const regionRaw = first(params.region);
  const region = (REGIONS as readonly string[]).includes(regionRaw ?? "") ? (regionRaw as Region) : null;
  let minManWon = parseManWon(params.min);
  let maxManWon = parseManWon(params.max);
  if (minManWon !== null && maxManWon !== null && minManWon > maxManWon) {
    [minManWon, maxManWon] = [maxManWon, minManWon];
  }
  const sortRaw = first(params.sort);
  const sort = (LISTING_SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as ListingSort) : "price_asc";
  return {
    region,
    minManWon,
    maxManWon,
    minWon: minManWon === null ? null : minManWon * MAN_WON,
    maxWon: maxManWon === null ? null : maxManWon * MAN_WON,
    sort,
  };
}

/** 318000000 → "3억 1,800만 원", 95000000 → "9,500만 원", 만 원 미만은 원 단위 그대로 */
export function formatKoreanPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount < 0) return "-";
  const fmt = new Intl.NumberFormat("ko-KR");
  if (amount < MAN_WON) return `${fmt.format(amount)}원`;
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / MAN_WON);
  const won = amount % MAN_WON;
  const parts: string[] = [];
  if (eok) parts.push(`${fmt.format(eok)}억`);
  if (man) parts.push(`${fmt.format(man)}만`);
  if (won) parts.push(fmt.format(won));
  return `${parts.join(" ")} 원`;
}

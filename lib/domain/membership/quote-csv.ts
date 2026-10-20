import { z } from "zod";
import { todayKst } from "@/lib/domain/booking/schema";
import { MAX_MEMBERSHIP_PRICE } from "./admin-schema";

/**
 * 운영자 시세 일괄 입력(CSV, D-74).
 * 브라우저에서 파싱·상품 매핑·행 검증을 해서 미리보기로 보여 주고, 서버 액션은 매핑된 행을 zod로 다시 검증한 뒤
 * DB 함수 bulk_upsert_quotes(한 트랜잭션, 1~500행)를 부른다. 최종 판단(권한·미래 날짜·상품 존재)은 DB가 한다.
 */

export const QUOTE_CSV_HEADER = ["골프장", "종류", "기준일", "매수시세", "매도시세"] as const;
export const MAX_QUOTE_ROWS = 500;

/** 양식 내려받기용 CSV(머리글 + 예시 1행). Excel이 UTF-8로 읽도록 BOM을 붙인다 */
export function quoteCsvTemplate(exampleDate: string): string {
  return `﻿${QUOTE_CSV_HEADER.join(",")}\r\n구골프 레이크CC,정회원,${exampleDate},325000000,315000000\r\n`;
}

// ── CSV 파서(RFC 4180 비슷하게: 따옴표, "" 이스케이프, CRLF/LF, 쉼표 또는 탭) ─────────
export type CsvParseResult = { records: string[][]; error?: string };

/** 첫 줄에 탭이 있으면 탭 구분(Excel에서 복사해 붙여넣은 경우), 아니면 쉼표 */
export function detectDelimiter(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") ? "\t" : ",";
}

export function parseCsv(input: string, delimiter: "," | "\t" = detectDelimiter(input)): CsvParseResult {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const endField = () => { record.push(field); field = ""; };
  const endRecord = () => { endField(); records.push(record); record = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"' && field === "") { inQuotes = true; i += 1; continue; }
    if (c === delimiter) { endField(); i += 1; continue; }
    if (c === "\r" && text[i + 1] === "\n") { endRecord(); i += 2; continue; }
    if (c === "\n" || c === "\r") { endRecord(); i += 1; continue; }
    field += c; i += 1;
  }
  if (inQuotes) return { records, error: "따옴표(\")가 닫히지 않았습니다. 파일 내용을 확인해 주세요." };
  // 마지막 줄 끝에 줄바꿈이 없어도 레코드로 넣는다(빈 꼬리는 제외)
  if (field !== "" || record.length > 0) endRecord();
  return { records };
}

// ── 값 정리 ──────────────────────────────────────────────
const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const productKey = (courseName: string, kind: string) => `${normalizeName(courseName)}\u0000${normalizeName(kind)}`;
const headerKey = (s: string) => s.replace(/\s+/g, "");

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** "2026-10-20", "2026/10/20", "2026.10.20." → "2026-10-20". 형식이 다르거나 없는 날짜면 null */
export function normalizeDate(raw: string): string | null {
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo = "", d = ""] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isRealDate(iso) ? iso : null;
}

/** "325,000,000원", " 325000000 " → 325000000. 빈 값은 null, 숫자가 아니거나 음수면 NaN */
export function parsePrice(raw: string): number | null {
  const s = raw.replace(/[\s,원]/g, "");
  if (s === "") return null;
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
}

// ── 미리보기 ─────────────────────────────────────────────
export type QuoteProductRef = { id: string; courseName: string; kind: string };

export type QuotePreviewRow = {
  /** 파일의 줄 번호(머리글이 1행, Excel 행 번호와 같다) */
  line: number;
  courseName: string;
  kind: string;
  quotedOn: string;
  buyPrice: number | null;
  sellPrice: number | null;
  productId: string | null;
  error: string | null;
};

export type QuotePreview = { rows: QuotePreviewRow[]; fileError?: string; errorCount: number };

/** 서버로 보내는 행(DB 함수 인자 형태) */
export type BulkQuoteRow = { product_id: string; quoted_on: string; buy_price: number | null; sell_price: number | null };

const HEADER_HELP = `첫 줄에 머리글(${QUOTE_CSV_HEADER.join(",")})이 필요합니다.`;

function priceError(label: string, v: number | null): string | null {
  if (v === null) return null;
  if (Number.isNaN(v)) return `${label}는 0 이상 숫자로 입력해 주세요.`;
  if (!Number.isSafeInteger(v) || v > MAX_MEMBERSHIP_PRICE) return `${label} 금액을 확인해 주세요.`;
  return null;
}

/** CSV 텍스트 → 행별 미리보기(상품 매핑·검증 포함). now로 "미래 날짜 금지"를 KST 기준으로 판단한다 */
export function previewQuoteCsv(text: string, products: readonly QuoteProductRef[], now: Date = new Date()): QuotePreview {
  if (text.includes("�")) {
    return { rows: [], errorCount: 0, fileError: "글자가 깨져 있습니다. Excel에서 'CSV UTF-8' 형식으로 저장해 주세요." };
  }
  const parsed = parseCsv(text);
  if (parsed.error) return { rows: [], errorCount: 0, fileError: parsed.error };

  const records = parsed.records;
  const headerIndex = records.findIndex((r) => r.some((f) => f.trim() !== ""));
  if (headerIndex < 0) return { rows: [], errorCount: 0, fileError: "내용이 없습니다. CSV를 붙여넣거나 파일을 선택해 주세요." };
  const header = (records[headerIndex] ?? []).map(headerKey);
  const col = Object.fromEntries(QUOTE_CSV_HEADER.map((h) => [h, header.indexOf(h)])) as Record<(typeof QUOTE_CSV_HEADER)[number], number>;
  if (Object.values(col).some((i) => i < 0)) return { rows: [], errorCount: 0, fileError: HEADER_HELP };

  const byKey = new Map(products.map((p) => [productKey(p.courseName, p.kind), p.id]));
  const today = todayKst(now);
  const seen = new Map<string, number>();
  const rows: QuotePreviewRow[] = [];

  records.forEach((r, idx) => {
    if (idx <= headerIndex || r.every((f) => f.trim() === "")) return;
    const get = (i: number) => (r[i] ?? "").trim();
    const courseName = get(col["골프장"]).replace(/\s+/g, " ");
    const kind = get(col["종류"]).replace(/\s+/g, " ");
    const rawDate = get(col["기준일"]);
    const buyPrice = parsePrice(get(col["매수시세"]));
    const sellPrice = parsePrice(get(col["매도시세"]));
    const quotedOn = normalizeDate(rawDate);
    const productId = courseName && kind ? byKey.get(productKey(courseName, kind)) ?? null : null;

    let error: string | null = null;
    if (!courseName) error = "골프장을 입력해 주세요.";
    else if (!kind) error = "종류를 입력해 주세요.";
    else if (!productId) error = "상품을 찾을 수 없습니다(골프장·종류 확인)";
    else if (!quotedOn) error = "기준일은 YYYY-MM-DD 형식으로 입력해 주세요.";
    else if (quotedOn > today) error = "오늘 이후 날짜는 입력할 수 없습니다.";
    else error = priceError("매수시세", buyPrice) ?? priceError("매도시세", sellPrice)
      ?? (buyPrice === null && sellPrice === null ? "매수 또는 매도 시세를 입력해 주세요." : null);

    const line = idx + 1;
    if (!error && productId && quotedOn) {
      const dupKey = `${productId}|${quotedOn}`;
      const first = seen.get(dupKey);
      if (first !== undefined) error = `같은 상품·기준일이 ${first}행에 이미 있습니다.`;
      else seen.set(dupKey, line);
    }
    rows.push({ line, courseName, kind, quotedOn: quotedOn ?? rawDate, buyPrice, sellPrice, productId, error });
  });

  const errorCount = rows.filter((r) => r.error).length;
  if (rows.length === 0) return { rows, errorCount, fileError: "머리글 아래에 시세 행이 없습니다." };
  if (rows.length > MAX_QUOTE_ROWS) {
    return { rows, errorCount, fileError: `한 번에 ${MAX_QUOTE_ROWS}행까지 반영할 수 있습니다(현재 ${rows.length}행). 파일을 나눠 주세요.` };
  }
  return { rows, errorCount };
}

/** 미리보기에 오류가 없을 때만 서버로 보낼 행을 만든다 */
export function toBulkQuoteRows(preview: QuotePreview): BulkQuoteRow[] | null {
  if (preview.fileError || preview.errorCount > 0 || preview.rows.length === 0) return null;
  return preview.rows.map((r) => ({
    product_id: r.productId as string,
    quoted_on: r.quotedOn,
    buy_price: r.buyPrice,
    sell_price: r.sellPrice,
  }));
}

// ── 서버 재검증 ──────────────────────────────────────────
const nullablePrice = z.number().int().min(0).max(MAX_MEMBERSHIP_PRICE).nullable();

/** 서버 액션이 받은 행을 다시 검증한다(브라우저 검증을 믿지 않는다). 메시지는 "N번째 행: ..." */
export const bulkQuoteRowsSchemaAt = (now: Date = new Date()) =>
  z
    .array(
      z
        .object({
          product_id: z.guid(),
          quoted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate).refine((d) => d <= todayKst(now), "future"),
          buy_price: nullablePrice,
          sell_price: nullablePrice,
        })
        .strict()
        .refine((v) => v.buy_price !== null || v.sell_price !== null, "price_required"),
    )
    .min(1)
    .max(MAX_QUOTE_ROWS)
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        const key = `${r.product_id}|${r.quoted_on}`;
        if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: "duplicate" });
        seen.add(key);
      });
    });

/** zod 실패 → 사용자 메시지(어느 행인지만 알려 준다) */
export function bulkQuoteIssueMessage(issues: readonly z.core.$ZodIssue[]): string {
  const first = issues[0];
  const row = typeof first?.path[0] === "number" ? first.path[0] + 1 : null;
  if (row === null) return `한 번에 1~${MAX_QUOTE_ROWS}행을 반영할 수 있습니다.`;
  return `${row}번째 행의 값을 확인해 주세요. 미리보기를 다시 실행해 주세요.`;
}

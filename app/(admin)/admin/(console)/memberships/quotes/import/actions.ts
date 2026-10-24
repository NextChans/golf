"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { toAppError } from "@/lib/domain/errors";
import { bulkQuoteIssueMessage, bulkQuoteRowsSchemaAt } from "@/lib/domain/membership/quote-csv";

export type ImportQuotesResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * 시세 일괄 반영(D-80). 브라우저 미리보기를 믿지 않고 zod로 다시 검증한 뒤 DB 함수 하나(한 트랜잭션)로 반영한다.
 * 한 행이라도 DB가 거부하면 전부 반영되지 않는다. DB의 행 번호(detail)는 화면에 내보내지 않는다(toAppError).
 */
export async function importQuotes(rows: unknown): Promise<ImportQuotesResult> {
  await requireStaff();
  const parsed = bulkQuoteRowsSchemaAt().safeParse(rows);
  if (!parsed.success) return { ok: false, error: bulkQuoteIssueMessage(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_upsert_quotes", { p_rows: parsed.data });
  if (error) {
    const appError = toAppError(error);
    return {
      ok: false,
      error: appError.code === "invalid_input"
        ? "반영하지 못했습니다. 상품이 삭제되었거나 값이 바뀌었을 수 있습니다. 새로고침 후 미리보기를 다시 실행해 주세요."
        : appError.message,
    };
  }
  // 운영자 상품 목록과 고객 시세 화면(최신 시세가 바뀜)을 함께 갱신한다(D-62)
  revalidatePath("/admin/memberships", "layout");
  revalidatePath("/memberships", "layout");
  return { ok: true, count: data ?? parsed.data.length };
}

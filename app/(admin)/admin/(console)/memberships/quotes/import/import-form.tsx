"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreLink, Tile } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { formatWon } from "@/lib/format/money";
import {
  MAX_QUOTE_ROWS,
  previewQuoteCsv,
  quoteCsvTemplate,
  toBulkQuoteRows,
  type QuotePreview,
  type QuoteProductRef,
} from "@/lib/domain/membership/quote-csv";
import { cn } from "@/lib/utils";
import { boxClass, FormAlert } from "../../form-parts";
import { importQuotes } from "./actions";

/**
 * 시세 일괄 입력 폼(D-80). 붙여넣기 또는 파일 → 미리보기(브라우저에서 파싱·상품 매핑·행 검증) → 오류 0건일 때만 반영.
 * 내용을 고치면 미리보기를 지워서, 확인하지 않은 내용이 반영되지 않게 한다.
 */
export function QuoteImportForm({ products, today }: { products: QuoteProductRef[]; today: string }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<QuotePreview | null>(null);
  const [error, setError] = useState<string>();
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const templateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(quoteCsvTemplate(today))}`,
    [today],
  );
  const rows = preview ? toBulkQuoteRows(preview) : null;
  const canSubmit = !!rows && rows.length >= 1 && rows.length <= MAX_QUOTE_ROWS && !pending;

  const runPreview = (value: string) => {
    setError(undefined);
    setSavedCount(null);
    setPreview(previewQuoteCsv(value, products));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0);
      // Excel 기본 "CSV(쉼표로 분리)"는 CP949로 저장된다: UTF-8로 읽다 깨지면 CP949(euc-kr)로 다시 읽는다
      let value: string;
      try {
        value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        value = new TextDecoder("euc-kr").decode(bytes);
      }
      setText(value);
      runPreview(value);
    };
    reader.onerror = () => setError("파일을 읽지 못했습니다. 다시 선택해 주세요.");
    reader.readAsArrayBuffer(file);
  };

  const submit = () => {
    if (!rows) return;
    setError(undefined);
    startTransition(async () => {
      const result = await importQuotes(rows);
      if (result.ok) {
        setSavedCount(result.count);
        setPreview(null);
        setText("");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Tile className="space-y-4 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="quote-csv-file" className="text-small font-semibold">CSV 파일 선택</label>
          <a href={templateHref} download="googolf-quotes-template.csv" className="pressable text-small text-primary hover:underline underline-offset-4">
            양식 내려받기
          </a>
        </div>
        <input
          id="quote-csv-file" type="file" accept=".csv,text/csv"
          className="block w-full text-small file:mr-3 file:rounded-full file:border-0 file:bg-background file:px-4 file:py-2 file:text-small"
          onChange={(e) => { onFile(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}
        />
        <div className="space-y-1.5">
          <label htmlFor="quote-csv-text" className="block text-small font-semibold">CSV 붙여넣기</label>
          <textarea
            id="quote-csv-text" rows={8} spellCheck={false} value={text}
            placeholder={"골프장,종류,기준일,매수시세,매도시세\n구골프 레이크CC,정회원,2026-10-20,325000000,315000000"}
            onChange={(e) => { setText(e.target.value); setPreview(null); setSavedCount(null); }}
            className={cn(boxClass, "min-h-40 px-4 py-3 font-mono text-small")}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => runPreview(text)} disabled={pending}>미리보기</Button>
        </div>
      </Tile>

      {savedCount !== null && (
        <Tile className="p-5 md:p-7">
          <p role="status" className="text-body text-primary">{savedCount}건을 반영했습니다.</p>
          <MoreLink href="/admin/memberships?tab=products" className="mt-2 text-small">상품·시세 목록 보기</MoreLink>
        </Tile>
      )}

      {preview && (
        <section aria-label="미리보기" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-small text-muted-foreground" data-testid="quote-import-summary">
              총 {preview.rows.length}행
              {preview.errorCount > 0 && <span className="text-destructive"> · 오류 {preview.errorCount}행</span>}
            </p>
            <Button type="button" onClick={submit} disabled={!canSubmit}>
              {pending ? "반영 중…" : `${preview.rows.length}건 반영`}
            </Button>
          </div>
          <FormAlert message={preview.fileError} />
          {preview.rows.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[640px] overflow-hidden rounded-tile border border-border/70 bg-card text-small">
                <thead className="bg-section text-left text-micro text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-normal">행</th>
                    <th scope="col" className="px-3 py-2 font-normal">골프장</th>
                    <th scope="col" className="px-3 py-2 font-normal">종류</th>
                    <th scope="col" className="px-3 py-2 font-normal">기준일</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">매수</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">매도</th>
                    <th scope="col" className="px-3 py-2 font-normal">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {preview.rows.map((r) => (
                    <tr key={r.line} className={r.error ? "bg-destructive/5" : undefined}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.line}</td>
                      <td className="px-3 py-2">{r.courseName}</td>
                      <td className="px-3 py-2">{r.kind}</td>
                      <td className="px-3 py-2 tabular-nums">{r.quotedOn}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatWon(r.buyPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatWon(r.sellPrice)}</td>
                      <td className={cn("px-3 py-2", r.error ? "text-destructive" : "text-primary")}>{r.error ?? "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <FormAlert message={error} />
    </div>
  );
}

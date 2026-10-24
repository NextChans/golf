"use client";

import { useId, useState } from "react";
import { Info, Minus, Plus } from "lucide-react";
import {
  calcCost, clampManWon, MAN_WON_STEP, parseManWon, validateManWon, type CostSide,
} from "@/lib/domain/market/detail";
import { formatManWon, type MembershipKind } from "@/lib/domain/market/schema";
import { cn } from "@/lib/utils";
import { primaryButtonClass } from "../ui";

const MAN = 10_000;
const SIDES = [["buy", "구매 비용"], ["sell", "판매 비용"]] as const;

/** 거래 비용 계산기. 금액은 만원 단위(기본값 = 현재 시세). 구매 = 금액 + 수수료, 판매 = 금액 − 수수료 */
export function CostCalculator({ kind, quote }: { kind: MembershipKind; quote: number }) {
  const [side, setSide] = useState<CostSide>("buy");
  const [text, setText] = useState(String(Math.floor(quote / MAN)));
  const [result, setResult] = useState<{ side: CostSide; price: number; fee: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const inputId = useId();

  const parsed = parseManWon(text);
  const preview = parsed !== null && parsed > 0 ? formatManWon(parsed * MAN) : "";

  function step(delta: number) {
    setText(String(clampManWon((parsed ?? 0) + delta)));
    setResult(null);
    setError("");
  }

  function calculate() {
    const err = validateManWon(parsed);
    if (err) { setError(err); setResult(null); return; }
    setError("");
    const price = parsed! * MAN;
    setResult({ side, price, ...calcCost(side, price, kind) });
  }

  return (
    <div>
      <h2 className="text-heading font-extrabold text-ink">거래 비용 계산기</h2>
      <p className="mt-2 text-label text-ink-mute">희망 금액을 입력하면 예상 비용을 바로 확인할 수 있어요</p>

      <div role="group" aria-label="계산 구분" className="mt-4 grid grid-cols-2 gap-1 rounded-control bg-fill p-1">
        {SIDES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={side === id}
            onClick={() => { setSide(id); setResult(null); setError(""); }}
            className={cn("pressable min-h-11 rounded-control text-label font-bold", side === id ? "bg-surface text-ink shadow-sm" : "text-ink-mute")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-card border border-line bg-fill p-4">
        <label htmlFor={inputId} className="text-label font-semibold text-ink-sub">
          {side === "buy" ? "얼마에 구매하고 싶으신가요?" : "얼마에 판매하고 싶으신가요?"}
        </label>
        <div className="mt-3 flex items-center rounded-control border border-line bg-surface pr-1">
          <input
            id={inputId}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            aria-invalid={error ? true : undefined}
            onChange={(e) => { setText(e.target.value.replace(/[^0-9]/g, "").slice(0, 9)); setResult(null); setError(""); }}
            className="min-h-14 min-w-0 flex-1 bg-transparent px-4 text-subhead font-bold text-ink tabular-nums outline-offset-2"
          />
          <span className="pr-2 text-subhead font-bold text-ink">만원</span>
          <button type="button" aria-label={`${MAN_WON_STEP}만원 늘리기`} onClick={() => step(MAN_WON_STEP)} className="pressable flex size-11 items-center justify-center text-ink-sub">
            <Plus aria-hidden className="size-5" />
          </button>
          <button type="button" aria-label={`${MAN_WON_STEP}만원 줄이기`} onClick={() => step(-MAN_WON_STEP)} className="pressable flex size-11 items-center justify-center text-ink-sub">
            <Minus aria-hidden className="size-5" />
          </button>
        </div>
        <p className="mt-2 min-h-6 px-1 text-label font-bold text-up tabular-nums">{preview}</p>
        {error && <p role="alert" className="px-1 pb-2 text-caption font-semibold text-up">{error}</p>}
        <button type="button" onClick={calculate} className={cn(primaryButtonClass, "mt-1 w-full")}>계산하기</button>
      </div>

      {result && (
        <div role="region" aria-label="예상 비용" className="mt-3 rounded-card border border-line bg-surface p-5">
          <dl className="space-y-3">
            <div className="flex justify-between gap-3 text-label">
              <dt className="text-ink-sub">{result.side === "buy" ? "구매 금액" : "판매 금액"}</dt>
              <dd className="font-bold text-ink tabular-nums">{formatManWon(result.price)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-label">
              <dt className="text-ink-sub">중개 수수료</dt>
              <dd className="font-bold text-ink tabular-nums">{formatManWon(result.fee)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3">
              <dt className="text-label font-bold text-ink">{result.side === "buy" ? "총 예상 비용" : "예상 수령액"}</dt>
              <dd className="text-subhead font-extrabold text-brand-ink tabular-nums">{formatManWon(result.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-caption text-ink-mute">명의개서 비용과 세금은 별도예요. 수수료 기준은 확정 전 예시 값이에요.</p>
        </div>
      )}

      <p className="mt-3 flex items-center gap-2 rounded-card bg-brand-soft px-4 py-4 text-label font-bold text-brand-ink">
        <Info aria-hidden className="size-5 shrink-0" />
        쿠폰은 거래 매칭 후 적용 가능해요
      </p>
    </div>
  );
}

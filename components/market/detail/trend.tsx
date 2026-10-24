"use client";

import { useMemo, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import {
  axisLabels, DEFAULT_PERIOD, periodChange, periodMinMax, PERIODS, trendSentence, type PeriodId,
} from "@/lib/domain/market/detail";
import { formatManWon } from "@/lib/domain/market/schema";
import { cn } from "@/lib/utils";
import { TrendChart } from "./trend-chart";

/** 시세 동향: 문장 + 차트 + 기간 탭(6개월/1년/3년/전체, 기본 3년). monthly는 서버가 만든 60개월(61점) 시세 */
export function PriceTrend({ monthly }: { monthly: number[] }) {
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const months = PERIODS.find((p) => p.id === period)!.months;
  const values = useMemo(() => monthly.slice(monthly.length - (months + 1)), [monthly, months]);
  const change = periodChange(values);
  const s = trendSentence(period, change);
  const { min, max } = periodMinMax(values);
  const axis = axisLabels(period);
  const color = s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : "text-ink-mute";

  return (
    <div>
      <h2 className="text-heading font-bold text-ink">시세 동향</h2>
      <p className="mt-2 text-label text-ink-sub" data-testid="trend-sentence">
        {s.lead}{" "}
        {s.value && <><strong className={cn("font-bold", color)}>{s.value}</strong>{" "}</>}
        <span className={s.tone === "flat" ? undefined : color}>{s.tail}</span>
        {s.tone === "up" && <Flame aria-hidden className="ml-1 inline size-5 align-text-bottom text-up" />}
        {s.tone === "down" && <Snowflake aria-hidden className="ml-1 inline size-5 align-text-bottom text-down" />}
      </p>
      <TrendChart
        values={values}
        tone={s.tone}
        start={axis.start}
        end={axis.end}
        label={`${s.text}. 최저 ${formatManWon(min)}, 최고 ${formatManWon(max)}`}
      />
      <div role="group" aria-label="기간" className="mt-3 grid grid-cols-4 gap-1 rounded-control bg-fill p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              "pressable min-h-11 rounded-control text-label font-bold",
              period === p.id ? "bg-surface text-ink shadow-sm" : "text-ink-mute",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

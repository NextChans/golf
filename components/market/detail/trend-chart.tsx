import { formatManWon } from "@/lib/domain/market/schema";
import { periodMinMax, type Tone } from "@/lib/domain/market/detail";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<Tone, string> = { up: "text-up", down: "text-down", flat: "text-ink-mute" };

/**
 * 시세 선 그래프(면 없이 선만). SVG는 0~100 좌표를 늘려 쓰고(non-scaling-stroke) 최고·최저 라벨은 HTML로 겹친다.
 * 위쪽 20%·아래 20%는 라벨 여백.
 */
export function TrendChart({ values, tone, start, end, label }: {
  values: readonly number[]; tone: Tone; start: string; end: string; label: string;
}) {
  const { min, max, minIndex, maxIndex } = periodMinMax(values);
  const span = max - min;
  const n = values.length - 1;
  const x = (i: number) => 2 + (i * 96) / Math.max(1, n);
  const y = (v: number) => (span === 0 ? 50 : 20 + ((max - v) * 60) / span);
  const points = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const clampX = (i: number) => Math.min(80, Math.max(20, x(i)));
  const lastY = y(values[n] ?? 0);

  return (
    <div className="mt-2">
      <div className={cn("relative h-52 w-full", TONE_CLASS[tone])}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label} className="absolute inset-0 size-full overflow-visible">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" style={{ left: `${x(n)}%`, top: `${lastY}%` }} />
        {span > 0 && (
          <>
            <span aria-hidden className="absolute -translate-x-1/2 text-caption font-bold whitespace-nowrap" style={{ left: `${clampX(maxIndex)}%`, top: `calc(${y(max)}% - 26px)` }}>
              최고 {formatManWon(max)}
            </span>
            <span aria-hidden className="absolute -translate-x-1/2 text-caption font-bold whitespace-nowrap" style={{ left: `${clampX(minIndex)}%`, top: `calc(${y(min)}% + 8px)` }}>
              최저 {formatManWon(min)}
            </span>
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between px-1 text-caption text-ink-mute tabular-nums">
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  );
}

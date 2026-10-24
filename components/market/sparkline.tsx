import { useId } from "react";

/**
 * 주간 시세 꺾은선(SVG, JS 없음). 선 아래는 연한 그라디언트 면, 마지막 점은 채운 원.
 * 값 범위가 0이면(변동 없음) 가운데 수평선. 접근성 이름은 호출부의 label로 요약한다.
 */
export function Sparkline({ values, label, height = 120, className }: {
  values: readonly number[]; label: string; height?: number; className?: string;
}) {
  const id = `spark${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const W = 320;
  const H = height;
  const pad = 10;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const x = (k: number) => pad + (k * (W - pad * 2)) / (values.length - 1);
  const y = (v: number) => (span === 0 ? H / 2 : pad + ((max - v) * (H - pad * 2)) / span);
  const points = values.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={className}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ink-mute)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--ink-mute)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last]!)} r="6" fill="var(--ink-sub)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

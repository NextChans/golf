import { FEE_POLICY } from "@/lib/mock/market";
import { hashString, seededRandom } from "./seed";
import { brokerageFee, currentPrice, formatRate, type FeePolicy, type MarketItem, type MembershipKind } from "./schema";

/**
 * 회원권 상세(/market/items/[id]) 순수 규칙(D-85). 시세 차트·기간 계산·거래 비용 계산기.
 * 월별 시세는 목업이라 id 시드로 결정론적으로 만든다(실데이터 연결 때 월별 집계로 교체).
 */

const MAN = 10_000;

/** 기준 연월(목업 "오늘" = 2026년 10월). MARKET_WEEK_LABEL과 맞춘다 */
export const MARKET_BASE = { year: 2026, month: 10 } as const;

export const PERIODS = [
  { id: "6m", label: "6개월", months: 6, phrase: "최근 6개월간" },
  { id: "1y", label: "1년", months: 12, phrase: "최근 1년간" },
  { id: "3y", label: "3년", months: 36, phrase: "최근 3년간" },
  { id: "all", label: "전체", months: 60, phrase: "전체 기간 동안" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];
export const DEFAULT_PERIOD: PeriodId = "3y";

const periodOf = (id: PeriodId) => PERIODS.find((p) => p.id === id)!;

/** 월별 시세 60개월(점 61개: 60개월 전 ~ 이번 달, 원). 마지막 값은 현재 시세, 최근 3개월은 12주 시세와 이어진다 */
export const MONTHLY_POINTS = 61;
export function monthlySeries(item: Pick<MarketItem, "id" | "weekly">): number[] {
  const rng = seededRandom(hashString(`${item.id}:monthly`));
  const last = MONTHLY_POINTS - 1;
  const w = item.weekly;
  const out = new Array<number>(MONTHLY_POINTS).fill(0);
  const at = (k: number) => w[Math.min(k, w.length - 1)] ?? 0;
  out[last] = currentPrice(item);
  out[last - 1] = at(8);
  out[last - 2] = at(4);
  out[last - 3] = at(0);
  // 60개월 전 가격 비율(0.62 ~ 1.45)로 완만한 추세 + 월별 잡음. 과거 쪽으로 걸어간다
  const total = Math.log(0.62 + rng() * 0.83);
  const drift = total / (last - 3);
  for (let i = last - 4; i >= 0; i--) {
    const noise = (rng() - 0.5) * 0.05;
    out[i] = out[i + 1]! * Math.exp(-drift + noise);
  }
  return out.map((v) => Math.max(MAN * 100, Math.round(v / MAN) * MAN));
}

/** 기간별 시세(월별 점, 길이 = 개월 수 + 1). 끝값은 항상 현재 시세 */
export function periodSeries(item: Pick<MarketItem, "id" | "weekly">, period: PeriodId): number[] {
  const all = monthlySeries(item);
  return all.slice(all.length - (periodOf(period).months + 1));
}

/** 기간 변화율(%), 소수 1자리. 시작값이 0이면 0 */
export function periodChange(series: readonly number[]): number {
  if (series.length < 2) return 0;
  const first = series[0]!;
  const last = series[series.length - 1]!;
  if (!first) return 0;
  return Math.round(((last - first) / first) * 1000) / 10;
}

export type MinMax = { min: number; max: number; minIndex: number; maxIndex: number };
/** 최고·최저와 첫 위치(동률이면 가장 최근 쪽이 아니라 앞쪽) */
export function periodMinMax(series: readonly number[]): MinMax {
  let minIndex = 0;
  let maxIndex = 0;
  series.forEach((v, i) => {
    if (v < series[minIndex]!) minIndex = i;
    if (v > series[maxIndex]!) maxIndex = i;
  });
  return { min: series[minIndex] ?? 0, max: series[maxIndex] ?? 0, minIndex, maxIndex };
}

export type Tone = "up" | "down" | "flat";
export const toneOf = (change: number): Tone => (change > 0 ? "up" : change < 0 ? "down" : "flat");

/** "최근 3년간 +39.0% 이상 상승했어요" 문장을 색을 입힐 수 있게 조각으로 */
export function trendSentence(period: PeriodId, change: number): { lead: string; value: string; tail: string; tone: Tone; text: string } {
  const lead = periodOf(period).phrase;
  const tone = toneOf(change);
  const value = tone === "flat" ? "" : formatRate(change);
  const tail = tone === "up" ? "이상 상승했어요" : tone === "down" ? "하락했어요" : "변동이 없어요";
  return { lead, value, tail, tone, text: [lead, value, tail].filter(Boolean).join(" ") };
}

/** 가로축 시작·끝 연월("23.10") */
export function axisLabels(period: PeriodId): { start: string; end: string } {
  const months = periodOf(period).months;
  const total = MARKET_BASE.year * 12 + (MARKET_BASE.month - 1);
  const fmt = (t: number) => `${String(Math.floor(t / 12) % 100).padStart(2, "0")}.${String((t % 12) + 1).padStart(2, "0")}`;
  return { start: fmt(total - months), end: fmt(total) };
}

/** 거래 비용 계산기 금액 상한(만원 단위 5,000,000 = 500억원) */
export const MAX_MAN_WON = 5_000_000;
export const MAN_WON_STEP = 100;

export function clampManWon(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(MAX_MAN_WON, Math.max(0, Math.round(v)));
}

/** 입력 문자열 → 만원 정수(숫자 외 문자는 무시). 비어 있으면 null */
export function parseManWon(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return Number(digits.slice(0, 12));
}

/** 계산 전 입력 검사. 오류 문구 또는 null */
export function validateManWon(v: number | null): string | null {
  if (v === null || v <= 0) return "금액을 1만원 이상으로 입력해 주세요";
  if (v > MAX_MAN_WON) return "5,000,000만원 이하로 입력해 주세요";
  return null;
}

export type CostSide = "buy" | "sell";
/** 거래 비용: 구매 = 금액 + 중개 수수료, 판매 = 금액 − 중개 수수료(음수 방지). 금액·결과는 원 */
export function calcCost(side: CostSide, price: number, kind: MembershipKind, policy: FeePolicy = FEE_POLICY): { fee: number; total: number } {
  if (!(price > 0)) return { fee: 0, total: 0 };
  const fee = brokerageFee(price, kind, policy);
  return { fee, total: side === "buy" ? price + fee : Math.max(0, price - fee) };
}

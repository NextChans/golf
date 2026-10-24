import type { Metadata } from "next";
import Link from "next/link";
import { Sparkline } from "@/components/market/sparkline";
import { AppScreen, Divider, rateClass, TopBar } from "@/components/market/ui";
import {
  applyMarketFilter, averageSeries, formatManWon, formatRate, MARKET_REGION_LABEL, MARKET_REGIONS, PRICE_BANDS, weeklyChangeRate,
} from "@/lib/domain/market/schema";
import { MARKET_ITEMS, MARKET_WEEK_LABEL } from "@/lib/mock/market";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "이번주 시세" };

export default function ReportPage() {
  const avg = averageSeries(MARKET_ITEMS);
  const rate = weeklyChangeRate(avg);
  const regions = MARKET_REGIONS.map((r) => {
    const items = MARKET_ITEMS.filter((i) => i.region === r);
    const s = averageSeries(items);
    return { r, count: items.length, price: s[s.length - 1] ?? 0, rate: weeklyChangeRate(s) };
  }).filter((x) => x.count > 0);

  return (
    <AppScreen withTabBar={false}>
      <TopBar title="이번주 시세" back="/" />
      <main className="pb-12">
        <section className="px-6 pt-4 pb-8">
          <p className="text-caption font-semibold text-ink-mute">전국 평균 · {MARKET_ITEMS.length}개 회원권</p>
          <p className="text-display font-bold tabular-nums">
            {formatManWon(avg[avg.length - 1] ?? 0)} <span className={cn("text-label font-bold", rateClass(rate))}>{formatRate(rate)}</span>
          </p>
          <Sparkline values={avg} label={`최근 12주 전국 평균 시세 추이, 이번 주 ${formatRate(rate)}`} className="mt-5 h-auto w-full" />
          <p className="mt-2 text-tiny text-ink-faint">{MARKET_WEEK_LABEL} · 전주 대비 변화율</p>
        </section>
        <Divider />
        <section aria-labelledby="region-title" className="px-6 pt-7">
          <h2 id="region-title" className="text-subhead font-bold text-ink">권역별 평균</h2>
          <ul className="mt-2 divide-y divide-line">
            {regions.map((x) => (
              <li key={x.r}>
                <Link href={`/market/search/results?region=${x.r}`} className="pressable flex items-center justify-between py-4">
                  <span className="text-label font-bold text-ink-sub">{MARKET_REGION_LABEL[x.r]} <span className="text-caption font-medium text-ink-mute">{x.count}개</span></span>
                  <span className="text-right tabular-nums">
                    <span className="block text-label font-bold">{formatManWon(x.price)}</span>
                    <span className={cn("text-caption font-semibold", rateClass(x.rate))}>{formatRate(x.rate)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <Divider />
        <section aria-labelledby="band-title" className="px-6 pt-7">
          <h2 id="band-title" className="text-subhead font-bold text-ink">예산별 회원권</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2.5">
            {PRICE_BANDS.map((b) => (
              <li key={b.id}>
                <Link href={`/market/search/results?band=${b.id}`} className="pressable block rounded-control bg-fill px-4 py-3">
                  <span className="block text-caption font-semibold text-ink-sub">{b.label}</span>
                  <span className="text-label font-bold text-ink">{applyMarketFilter(MARKET_ITEMS, { regions: [], bands: [b.id], q: "" }).length}개</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppScreen>
  );
}

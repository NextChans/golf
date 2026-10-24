import Link from "next/link";
import { Bell, Building2, ChartLine, ChevronRight, ClipboardList, Heart, Search, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DealTicker } from "@/components/market/deal-ticker";
import { HomePopups } from "@/components/market/home-popups";
import { CompanyFooter } from "@/components/market/company-footer";
import { InviteCard } from "@/components/market/invite-card";
import { ItemCardList } from "@/components/market/item-card";
import { PromoCarousel } from "@/components/market/promo-carousel";
import { RecentList } from "@/components/market/recent";
import { REGION_TONE } from "@/components/market/region-tone";
import { SellEstimator } from "@/components/market/sell-estimator";
import { Sparkline } from "@/components/market/sparkline";
import { AppScreen, rateClass, StateView } from "@/components/market/ui";
import {
  averageSeries, currentPrice, formatManWon, formatRate, LIST_TABS, MARKET_REGION_LABEL, MARKET_REGIONS, sortForTab, weeklyChangeRate, type ListTab,
} from "@/lib/domain/market/schema";
import { BANNERS, findMarketItem, MARKET_ITEMS, MARKET_WEEK_LABEL, NOTIFICATIONS, RECENT_DEALS } from "@/lib/mock/market";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BANNER_ICON = { shield: ShieldCheck, building: Building2, chart: ChartLine } as const;

export default async function MarketHome({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = sp.tab === "sell" ? "sell" : "buy";
  const list: ListTab = LIST_TABS.some((t) => t.id === sp.list) ? (sp.list as ListTab) : "instant";

  const deals = RECENT_DEALS.flatMap((d) => {
    const item = findMarketItem(d.itemId);
    return item ? [{ itemId: d.itemId, courseName: item.courseName, price: d.price }] : [];
  });
  const avg = averageSeries(MARKET_ITEMS);
  const avgRate = weeklyChangeRate(avg);
  const rows = sortForTab(MARKET_ITEMS, list).slice(0, 20).map((i) => ({
    id: i.id,
    courseName: i.courseName,
    kind: i.kind,
    amount: list === "instant" && i.askPrice !== null ? i.askPrice : currentPrice(i),
    rate: weeklyChangeRate(i.weekly),
  }));
  const recentData = MARKET_ITEMS.map((i) => ({
    id: i.id, courseName: i.courseName, kind: i.kind, region: i.region, price: currentPrice(i), rate: weeklyChangeRate(i.weekly),
  }));
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <AppScreen tone="canvas">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-canvas px-6">
        <Logo href="/market" />
        <div className="flex items-center gap-1">
          <Link href="/market/notifications" aria-label={unread ? `알림 ${unread}개 안 읽음` : "알림"} className="pressable relative flex size-11 items-center justify-center text-ink-sub">
            <Bell className="size-7" aria-hidden />
            {unread > 0 && <span aria-hidden className="absolute top-2 right-2.5 size-2 rounded-full bg-up" />}
          </Link>
          <Link href="/market/mypage/favorites" aria-label="관심 회원권" className="pressable flex size-11 items-center justify-center text-ink-sub">
            <Heart className="size-7" aria-hidden />
          </Link>
        </div>
      </header>
      <DealTicker deals={deals} />

      <main className="min-h-[70dvh] rounded-t-sheet bg-surface">
        <nav aria-label="거래 구분" className="grid grid-cols-2 border-b border-line">
          {([["buy", "회원권 구매"], ["sell", "회원권 판매"]] as const).map(([id, label]) => (
            <Link
              key={id}
              href={id === "buy" ? "/market" : "/market?tab=sell"}
              scroll={false}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "pressable relative flex h-16 items-center justify-center text-subhead font-bold",
                tab === id ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-ink" : "text-ink-mute",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {tab === "buy" ? (
          <div className="px-6 pt-7 pb-10">
            <Link
              href="/market/search"
              className="pressable flex h-14 items-center gap-3 rounded-full border border-line px-5 text-label font-semibold text-ink-mute shadow-[0_6px_16px_-10px_rgb(0_0_0/0.2)]"
            >
              <Search className="size-6 text-ink-sub" aria-hidden />
              어떤 회원권을 찾고 계신가요?
            </Link>

            <ul aria-label="기획전" className="no-scrollbar -mx-6 mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6">
              {BANNERS.map((b) => {
                const Icon = BANNER_ICON[b.icon];
                return (
                  <li key={b.id} className="w-[72%] max-w-[300px] shrink-0 snap-start">
                    <Link href={b.href as never} className={`pressable relative flex aspect-square flex-col overflow-hidden rounded-card bg-gradient-to-b ${b.tone} p-6 text-white`}>
                      <span className="whitespace-pre-line text-heading font-bold">{b.title}</span>
                      <Icon className="absolute right-5 bottom-5 size-24 text-white/85" strokeWidth={1.3} aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link href="/market/report" className="pressable mt-7 block rounded-card border border-line px-6 pt-6 pb-5">
              <span className="flex items-center justify-between text-label font-semibold text-ink-mute">
                이번주 시세 <ChevronRight className="size-5 text-ink-faint" aria-hidden />
              </span>
              <span className="mt-1 block text-heading font-bold text-ink tabular-nums">
                전국 평균 {formatManWon(avg[avg.length - 1] ?? 0)}{" "}
                <span className={cn("text-label font-semibold", rateClass(avgRate))}>{formatRate(avgRate)}</span>
              </span>
              <Sparkline values={avg} label={`최근 12주 전국 평균 시세 추이, 이번 주 ${formatRate(avgRate)}`} className="mt-4 h-auto w-full" />
              <span className="mt-3 block text-label font-semibold text-ink-faint">{MARKET_WEEK_LABEL}</span>
            </Link>

            <section aria-label="회원권 목록" className="mt-7">
              <nav aria-label="목록 정렬" className="grid grid-cols-4 rounded-control bg-fill p-1">
                {LIST_TABS.map((t) => (
                  <Link
                    key={t.id}
                    href={t.id === "instant" ? "/market" : `/market?list=${t.id}`}
                    scroll={false}
                    aria-current={list === t.id ? "true" : undefined}
                    className={cn(
                      "pressable flex h-10 items-center justify-center rounded-[10px] text-label font-bold",
                      list === t.id ? "bg-surface text-ink shadow-sm" : "text-ink-mute",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </nav>
              {rows.length ? (
                <ItemCardList key={list} items={rows} instant={list === "instant"} />
              ) : (
                <StateView title="이번 주에는 해당하는 회원권이 없어요" body="다른 정렬을 골라 보세요." />
              )}
              <Link href="/market/search/results" className="pressable mt-3 flex h-10 items-center justify-center text-caption font-semibold text-ink-mute underline underline-offset-4">
                전체 회원권 보기
              </Link>
            </section>

            <RecentList items={recentData} />

            <section aria-labelledby="region-title" className="mt-12">
              <h2 id="region-title" className="text-heading font-bold text-ink">지역별 회원권</h2>
              <ul className="no-scrollbar -mx-6 mt-4 flex gap-3 overflow-x-auto px-6">
                {[{ href: "/market/search/results", label: "전체", tone: "from-[#8fb98a] via-[#5c9c4f] to-[#2b6a35]" }, ...MARKET_REGIONS.map((r) => ({
                  href: `/market/search/results?region=${r}`, label: MARKET_REGION_LABEL[r], tone: REGION_TONE[r],
                }))].map((t) => (
                  <li key={t.label} className="shrink-0">
                    <Link
                      href={t.href as never}
                      className={cn("pressable flex size-[92px] items-center justify-center rounded-full bg-gradient-to-b text-label font-semibold text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.45)]", t.tone)}
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <PromoCarousel />
            <InviteCard />
          </div>
        ) : (
          <div className="flex min-h-[60dvh] flex-col">
            <div className="flex-1 px-6 pt-10 pb-10">
              <h1 className="text-display font-bold text-ink">
                내 회원권,
                <br />
                지금 팔면 얼마일까?
              </h1>
              <SellEstimator />
            </div>
            <Link href="/market/report" className="pressable flex items-center gap-4 bg-info-soft px-6 py-5">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6c8cff] to-[#ff7a8a] text-white">
                <ChartLine className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label font-bold text-ink-sub">회원권 판매, 아직 고민 중이라면?</span>
                <span className="flex items-center gap-1 text-subhead font-bold text-info">
                  주간 시세 리포트 먼저 받아보기 <ClipboardList className="size-5" aria-hidden />
                </span>
              </span>
              <ChevronRight className="size-6 text-ink-sub" aria-hidden />
            </Link>
          </div>
        )}
        {tab === "buy" && <CompanyFooter />}
      </main>
      <HomePopups />
    </AppScreen>
  );
}

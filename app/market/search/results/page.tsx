import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { ItemRow } from "@/components/market/item-row";
import { AppScreen, StateView, TopBar } from "@/components/market/ui";
import { applyMarketFilter, filterToQuery, MARKET_REGION_LABEL, parseMarketFilter, PRICE_BANDS } from "@/lib/domain/market/schema";
import { MARKET_ITEMS } from "@/lib/mock/market";

export const metadata: Metadata = { title: "검색 결과" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MarketResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const filter = parseMarketFilter(await searchParams);
  const items = applyMarketFilter(MARKET_ITEMS, filter);
  const chips = [
    ...(filter.q ? [`"${filter.q}"`] : []),
    ...filter.regions.map((r) => MARKET_REGION_LABEL[r]),
    ...filter.bands.map((id) => PRICE_BANDS.find((b) => b.id === id)!.label),
  ];
  const editHref = `/market/search${filterToQuery(filter)}`;

  return (
    <AppScreen withTabBar={false}>
      <TopBar title="회원권 검색" back="/market/search" />
      <div className="flex items-center gap-2 px-6 pt-2 pb-3">
        <ul aria-label="적용한 조건" className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {chips.length ? chips.map((c) => (
            <li key={c} className="shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-caption font-semibold text-brand-ink">{c}</li>
          )) : <li className="text-caption font-semibold text-ink-mute">전체 회원권</li>}
        </ul>
        <Link href={editHref as never} className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-caption font-semibold text-ink-sub">
          <SlidersHorizontal className="size-4" aria-hidden /> 조건 변경
        </Link>
      </div>
      <main className="px-6 pb-10">
        <p className="text-caption text-ink-mute">회원권 {items.length}건 · 이번 주 시세 기준</p>
        {items.length ? (
          <ul className="divide-y divide-line">{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>
        ) : (
          <StateView
            title="조건에 맞는 회원권이 없어요"
            body="지역이나 가격대를 넓혀 다시 찾아보세요."
            action={<Link href="/market/search" className="text-label font-bold text-brand-ink underline underline-offset-4">조건 다시 고르기</Link>}
          />
        )}
      </main>
    </AppScreen>
  );
}

import type { Metadata, Route } from "next";
import Link from "next/link";
import { Filter } from "lucide-react";
import { CourseCard } from "@/components/market/course/course-card";
import { SortSheet } from "@/components/market/course/sort-sheet";
import { FloatingInquiry } from "@/components/market/floating-inquiry";
import { AppScreen, StateView, TopBar } from "@/components/market/ui";
import { DEFAULT_SORT, filterButtonLabel, groupByCourse, parseSort, SORT_OPTIONS, sortGroups, type SortKey } from "@/lib/domain/market/group";
import { applyMarketFilter, filterToQuery, MARKET_REGION_LABEL, parseMarketFilter, PRICE_BANDS } from "@/lib/domain/market/schema";
import { MARKET_ITEMS } from "@/lib/mock/market";

export const metadata: Metadata = { title: "검색 결과" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 현재 조건 쿼리에 sort만 바꾼 경로(기본값은 쿼리에서 뺀다) */
function sortHref(filterQuery: string, sort: SortKey) {
  const p = new URLSearchParams(filterQuery.replace(/^\?/, ""));
  if (sort !== DEFAULT_SORT) p.set("sort", sort);
  const s = p.toString();
  // 쿼리 문자열이 붙는 동적 경로라 Route로 좁힌다(typedRoutes 권장 방식)
  return `/market/search/results${s ? `?${s}` : ""}` as Route;
}

export default async function MarketResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = parseMarketFilter(sp);
  const sort = parseSort(sp.sort);
  const items = applyMarketFilter(MARKET_ITEMS, filter);
  const groups = sortGroups(groupByCourse(items), sort);
  const chips = [
    ...(filter.q ? [`"${filter.q}"`] : []),
    ...filter.regions.map((r) => MARKET_REGION_LABEL[r]),
    ...filter.bands.map((id) => PRICE_BANDS.find((b) => b.id === id)!.label),
  ];
  const fq = filterToQuery(filter);
  const sortHrefs = Object.fromEntries(SORT_OPTIONS.map((o) => [o.id, sortHref(fq, o.id)])) as Record<SortKey, Route>;

  return (
    <AppScreen withTabBar={false} className="pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      <TopBar title="회원권 검색" back="/market/search" right={<SortSheet current={sort} hrefs={sortHrefs} />} />
      <div className="px-6 pt-2 pb-3">
        <ul aria-label="적용한 조건" className="no-scrollbar flex gap-2 overflow-x-auto">
          {chips.length ? chips.map((c) => (
            <li key={c} className="shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-caption font-semibold text-brand-ink">{c}</li>
          )) : <li className="text-caption font-semibold text-ink-mute">전체 회원권</li>}
        </ul>
      </div>
      <main className="px-6">
        <p className="mb-3 text-caption text-ink-mute">
          골프장 {groups.length}곳 · 회원권 {items.length}건 · 이번 주 시세 기준
        </p>
        {groups.length ? (
          <ul aria-label="골프장" className="flex flex-col gap-3">{groups.map((g) => <CourseCard key={g.courseId} group={g} />)}</ul>
        ) : (
          <StateView
            title="조건에 맞는 회원권이 없어요"
            body="지역이나 가격대를 넓혀 다시 찾아보세요."
            action={<Link href="/market/search" className="text-label font-bold text-brand-ink underline underline-offset-4">조건 다시 고르기</Link>}
          />
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto flex max-w-[480px] justify-center px-4">
          <Link
            href={`/market/search${fq}` as Route}
            className="pressable pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-brand px-5 text-label font-bold text-white shadow-lg hover:bg-brand-hover"
          >
            <Filter aria-hidden className="size-5" />
            {filterButtonLabel(filter)}
          </Link>
        </div>
      </div>
      <FloatingInquiry position="stacked" />
    </AppScreen>
  );
}

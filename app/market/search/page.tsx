import type { Metadata } from "next";
import { SearchFilter } from "@/components/market/search-filter";
import { parseMarketFilter } from "@/lib/domain/market/schema";

export const metadata: Metadata = { title: "맞춤 회원권 검색" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MarketSearchPage({ searchParams }: { searchParams: SearchParams }) {
  return <SearchFilter initial={parseMarketFilter(await searchParams)} />;
}

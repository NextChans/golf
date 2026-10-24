"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Search } from "lucide-react";
import type { Region } from "@/lib/domain/course/schema";
import {
  applyMarketFilter, filterToQuery, MARKET_REGION_LABEL, MARKET_REGIONS, PRICE_BANDS, type MarketFilter, type PriceBandId,
} from "@/lib/domain/market/schema";
import { MARKET_ITEMS } from "@/lib/mock/market";
import { cn } from "@/lib/utils";
import { REGION_TONE } from "./region-tone";
import { chipClass, primaryButtonClass, secondaryButtonClass } from "./ui";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** 맞춤 회원권 검색: 지역(복수)·가격대(복수)·검색어. 조건 없이 누르면 "전체보기", 있으면 "N건 보기" */
export function SearchFilter({ initial }: { initial: MarketFilter }) {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>(initial.regions);
  const [bands, setBands] = useState<PriceBandId[]>(initial.bands);
  const [q, setQ] = useState(initial.q);
  const filter = { regions, bands, q: q.trim() };
  const count = useMemo(() => applyMarketFilter(MARKET_ITEMS, { regions, bands, q: q.trim() }).length, [regions, bands, q]);
  const any = regions.length > 0 || bands.length > 0 || q.trim() !== "";

  const submit = () => router.push(`/market/search/results${filterToQuery(filter)}` as never);

  return (
    <div className="min-h-dvh bg-canvas">
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="mx-auto flex h-[76px] max-w-[480px] items-center gap-2 px-3"
      >
        <Link href="/" aria-label="뒤로" className="pressable flex size-11 shrink-0 items-center justify-center text-ink-sub">
          <ChevronLeft className="size-7" aria-hidden />
        </Link>
        <label className="flex h-12 flex-1 items-center gap-2 rounded-control border border-line bg-surface px-4 focus-within:border-brand">
          <Search className="size-5 shrink-0 text-ink-faint" aria-hidden />
          <span className="sr-only">검색어</span>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={40} enterKeyHint="search"
            placeholder="지역, 골프장명, 키워드 검색"
            className="min-w-0 flex-1 bg-transparent text-label font-medium text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
      </form>

      <div className="mx-auto max-w-[480px] rounded-t-sheet bg-surface px-6 pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <h1 className="text-heading font-bold text-ink">맞춤 회원권 검색</h1>

        <fieldset className="mt-8">
          <legend className="text-subhead font-bold text-ink-sub">지역별</legend>
          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-4">
            {MARKET_REGIONS.map((r) => {
              const on = regions.includes(r);
              return (
                <button
                  key={r} type="button" aria-pressed={on} onClick={() => setRegions(toggle(regions, r))}
                  className={cn(
                    "pressable relative mx-auto flex aspect-square w-full max-w-[104px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-b text-subhead font-semibold text-white",
                    REGION_TONE[r], on && "ring-[3px] ring-brand ring-offset-2 ring-offset-surface",
                  )}
                >
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-[#2f6f35]/60" />
                  <span className="relative [text-shadow:0_1px_4px_rgb(0_0_0/0.45)]">{MARKET_REGION_LABEL[r]}</span>
                  {on && <Check className="absolute top-3 right-4 size-5 rounded-full bg-brand p-0.5" aria-hidden />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-10">
          <legend className="text-subhead font-bold text-ink-sub">가격대</legend>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {PRICE_BANDS.map((b) => (
              <button key={b.id} type="button" aria-pressed={bands.includes(b.id)} onClick={() => setBands(toggle(bands, b.id))} className={chipClass}>
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe">
        <div className="mx-auto grid max-w-[480px] grid-cols-[auto_1fr] gap-3 px-6 py-3">
          <button type="button" className={`${secondaryButtonClass} w-[112px]`} onClick={() => { setRegions([]); setBands([]); setQ(""); }}>
            초기화
          </button>
          <button type="button" className={primaryButtonClass} onClick={submit} disabled={any && count === 0}>
            {any ? (count ? `${count}건 보기` : "조건에 맞는 회원권 없음") : "전체보기"}
          </button>
        </div>
      </div>
    </div>
  );
}

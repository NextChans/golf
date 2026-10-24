"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Region } from "@/lib/domain/course/schema";
import { filterToQuery, MARKET_REGION_LABEL, MARKET_REGIONS, PRICE_BANDS, type PriceBandId } from "@/lib/domain/market/schema";
import { STORAGE_KEYS, writeJson } from "./storage";
import { chipClass, primaryButtonClass } from "./ui";

/**
 * 첫 방문 안내 + 취향 고르기. 앱의 추적 허용(ATT) 화면 대신 웹에서는 관심 지역·예산을 직접 받는다
 * (제3자 추적을 하지 않으므로 동의 화면 자체가 필요 없다). 고른 값은 이 브라우저에만 저장.
 */
export function Welcome() {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>([]);
  const [band, setBand] = useState<PriceBandId | null>(null);
  const toggle = (r: Region) => setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const finish = (skip: boolean) => {
    writeJson(STORAGE_KEYS.welcomed, true);
    if (!skip) writeJson(STORAGE_KEYS.prefs, { regions, band });
    const pick = !skip && (regions.length > 0 || band);
    router.replace((pick ? `/market/search/results${filterToQuery({ regions, bands: band ? [band] : [], q: "" })}` : "/market") as never);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[480px] flex-col bg-surface px-6 pt-16 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <h1 className="text-center text-display font-extrabold text-ink">
        Googolf가 고객님께
        <br />
        <span className="text-brand-ink">딱 맞는 회원권을</span> 찾아드릴게요
      </h1>
      <p className="mt-4 text-center text-label font-medium text-ink-sub">관심 지역과 예산을 고르면 맞춤 회원권을 먼저 보여 드려요.</p>

      <fieldset className="mt-10">
        <legend className="text-label font-bold text-ink-sub">관심 지역 <span className="font-medium text-ink-mute">(여러 개)</span></legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {MARKET_REGIONS.map((r) => (
            <button key={r} type="button" aria-pressed={regions.includes(r)} onClick={() => toggle(r)} className={chipClass}>{MARKET_REGION_LABEL[r]}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-8">
        <legend className="text-label font-bold text-ink-sub">예산</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRICE_BANDS.map((b) => (
            <button key={b.id} type="button" aria-pressed={band === b.id} onClick={() => setBand(band === b.id ? null : b.id)} className={chipClass}>{b.label}</button>
          ))}
        </div>
      </fieldset>

      <div className="mt-auto pt-10">
        <button type="button" onClick={() => finish(false)} className={`${primaryButtonClass} w-full`}>계속하기</button>
        <button type="button" onClick={() => finish(true)} className="pressable mt-3 h-11 w-full text-label font-semibold text-ink-mute">나중에 할게요</button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Region } from "@/lib/domain/course/schema";
import { pushRecent } from "@/lib/domain/market/recent";
import { formatManWon, formatRate, MARKET_REGION_LABEL } from "@/lib/domain/market/schema";
import { FavoriteButton } from "./favorites";
import { REGION_TONE } from "./region-tone";
import { readJson, STORAGE_KEYS, writeJson } from "./storage";
import { rateClass } from "./ui";
import { cn } from "@/lib/utils";

const EMPTY: string[] = [];
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function snapshot(): string[] {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(STORAGE_KEYS.recent); } catch { /* 접근 불가 */ }
  if (raw !== cache.raw) {
    const parsed = readJson<unknown>(STORAGE_KEYS.recent, EMPTY);
    cache = { raw, ids: Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY };
  }
  return cache.ids;
}
function subscribe(cb: () => void) {
  window.addEventListener("googolf-storage", cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener("googolf-storage", cb); window.removeEventListener("storage", cb); };
}

/** 회원권 상세 진입 시 최근 확인 목록에 기록(이 브라우저에만 저장) */
export function RecordView({ id }: { id: string }) {
  useEffect(() => {
    writeJson(STORAGE_KEYS.recent, pushRecent(snapshot(), id));
  }, [id]);
  return null;
}

export type RecentCardData = { id: string; courseName: string; kind: string; region: Region; price: number; rate: number };

/** 홈 "최근 확인한 회원권" 가로 카드. 기록이 없으면 섹션 전체를 숨긴다 */
export function RecentList({ items }: { items: RecentCardData[] }) {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const cards = ids.flatMap((id) => items.find((i) => i.id === id) ?? []);
  if (!cards.length) return null;
  return (
    <section aria-labelledby="recent-title" className="mt-12">
      <h2 id="recent-title" className="text-heading font-extrabold text-ink">최근 확인한 회원권</h2>
      <ul className="no-scrollbar -mx-6 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6">
        {cards.map((c) => (
          <li key={c.id} className="relative w-[56%] shrink-0 snap-start">
            <Link href={`/market/items/${c.id}`} className="pressable block overflow-hidden rounded-card border border-line bg-surface">
              <span aria-hidden className={cn("block h-28 bg-gradient-to-b", REGION_TONE[c.region])} />
              <span className="block px-4 pt-3 pb-4">
                <span className="block truncate text-subhead font-bold text-ink">{c.courseName}</span>
                <span className="block text-caption text-ink-mute">{c.kind}</span>
                <span className="mt-3 block">
                  <span className="block truncate text-label font-bold text-ink tabular-nums">{formatManWon(c.price)}</span>
                  <span className={cn("block text-caption font-semibold tabular-nums", rateClass(c.rate))}>{formatRate(c.rate)}</span>
                </span>
                <span className="sr-only">{MARKET_REGION_LABEL[c.region]}</span>
              </span>
            </Link>
            <FavoriteButton id={c.id} name={c.courseName} className="absolute top-1 right-1 [&_svg]:size-8 [&_svg]:rounded-full [&_svg]:bg-white/90 [&_svg]:p-1.5 [&_svg:not(.fill-up)]:text-[#191f28]" />
          </li>
        ))}
      </ul>
    </section>
  );
}

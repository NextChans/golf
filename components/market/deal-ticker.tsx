"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatManWon } from "@/lib/domain/market/schema";

export type TickerDeal = { itemId: string; courseName: string; price: number };

/** 상단 "거래 체결" 한 줄 티커. 3초마다 다음 체결로 넘긴다(동작 줄이기 설정이면 넘기지 않음) */
export function DealTicker({ deals }: { deals: TickerDeal[] }) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (deals.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setK((v) => (v + 1) % deals.length), 3000);
    return () => window.clearInterval(t);
  }, [deals.length]);
  const d = deals[k];
  if (!d) return null;
  return (
    <Link
      href={`/market/items/${d.itemId}`}
      aria-label={`최근 거래 체결 ${d.courseName} ${formatManWon(d.price)}`}
      className="pressable flex h-12 items-center gap-3 overflow-hidden px-6 text-label"
    >
      <span className="shrink-0 font-semibold text-brand-ink">거래 체결</span>
      <span key={k} className="ticker-in flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate font-bold text-ink-sub">{d.courseName}</span>
        <span className="flex shrink-0 items-center font-bold text-ink-sub tabular-nums">
          {formatManWon(d.price)}
          <ChevronRight className="size-4 text-ink-faint" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

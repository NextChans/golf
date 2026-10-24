"use client";

import { useState } from "react";
import { formatManWon } from "@/lib/domain/market/schema";
import type { DealRow } from "@/lib/mock/market-detail";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "deals", label: "체결 거래", head: ["거래일", "거래가"], empty: "아직 체결된 거래가 없어요" },
  { id: "listings", label: "구매 가능 매물", head: ["등록일", "호가"], empty: "구매 가능한 매물이 없어요" },
  { id: "bids", label: "판매 입찰", head: ["입찰일", "입찰가"], empty: "판매 입찰이 없어요" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** 실거래가 및 입찰가: 체결 / 구매 가능 매물 / 판매 입찰 표 */
export function DealTables({ rows }: { rows: Record<TabId, DealRow[]> }) {
  const [tab, setTab] = useState<TabId>("deals");
  const cur = TABS.find((t) => t.id === tab)!;
  const list = rows[tab];
  return (
    <div>
      <h2 className="text-heading font-bold text-ink">실거래가 및 입찰가</h2>
      <div role="group" aria-label="거래 구분" className="mt-4 grid grid-cols-3 gap-1 rounded-control bg-fill p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "pressable min-h-11 rounded-control px-1 text-caption font-bold whitespace-nowrap",
              tab === t.id ? "bg-surface text-ink shadow-sm" : "text-ink-mute",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="mt-6 rounded-card bg-fill px-4 py-8 text-center text-label text-ink-mute">{cur.empty}</p>
      ) : (
        <table className="mt-3 w-full text-left">
          <caption className="sr-only">{cur.label}</caption>
          <thead>
            <tr className="border-b border-line text-label text-ink-sub">
              <th scope="col" className="px-2 py-3 font-semibold">{cur.head[0]}</th>
              <th scope="col" className="px-2 py-3 font-semibold">{cur.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={`${r.date}-${i}`} className="border-b border-line last:border-0">
                <td className="px-2 py-4 text-label text-ink-mute tabular-nums">{r.date}</td>
                <td className="px-2 py-4 text-label font-bold text-ink tabular-nums">{formatManWon(r.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

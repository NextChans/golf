"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatManWon, formatRate } from "@/lib/domain/market/schema";
import { cn } from "@/lib/utils";
import { rateClass } from "./ui";

export type ItemCardData = { id: string; courseName: string; kind: string; amount: number; rate: number };

const PAGE = 5;

/** 홈 목록 카드 1건: 첫 글자 아바타(로고 이미지 없음), 이름·유형, 가격과 구매가능/변화율 */
export function ItemCard({ item, instant }: { item: ItemCardData; instant: boolean }) {
  return (
    <li>
      <Link href={`/market/items/${item.id}`} className="pressable flex min-h-[92px] items-center gap-3 rounded-card bg-fill px-4 py-4">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface text-heading font-extrabold text-brand-ink shadow-sm">
          {item.courseName.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label font-bold text-ink">{item.courseName}</span>
          <span className="block truncate text-caption text-ink-mute">{item.kind}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-label font-bold text-ink tabular-nums">{formatManWon(item.amount)}</span>
          {instant ? (
            <span className="block text-caption font-bold text-up">구매가능</span>
          ) : (
            <span className={cn("block text-caption font-semibold tabular-nums", rateClass(item.rate))}>{formatRate(item.rate)}</span>
          )}
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-faint" aria-hidden />
      </Link>
    </li>
  );
}

/** 처음 5건만 보이고 "더보기"로 5건씩 늘린다. 전부 보이면 버튼을 숨긴다 */
export function ItemCardList({ items, instant }: { items: ItemCardData[]; instant: boolean }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      <ul className="mt-3 space-y-3">
        {items.slice(0, shown).map((item) => <ItemCard key={item.id} item={item} instant={instant} />)}
      </ul>
      {shown < items.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="pressable mt-3 flex h-14 w-full items-center justify-center rounded-card border border-line text-subhead font-bold text-ink-sub hover:bg-fill"
        >
          더보기
        </button>
      )}
    </>
  );
}

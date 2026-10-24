import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { currentPrice, formatManWon, formatRate, MARKET_REGION_LABEL, weeklyChangeRate, type MarketItem } from "@/lib/domain/market/schema";
import { rateClass } from "./ui";

/**
 * 회원권 목록 행. price="ask"면 즉시 구매가(매물 최저가), 기본은 이번 주 시세.
 * 접근성 이름에 골프장명·유형·가격이 모두 들어가도록 한 링크로 감싼다.
 */
export function ItemRow({ item, price = "quote", rank }: { item: MarketItem; price?: "quote" | "ask"; rank?: number }) {
  const rate = weeklyChangeRate(item.weekly);
  const amount = price === "ask" && item.askPrice !== null ? item.askPrice : currentPrice(item);
  return (
    <li>
      <Link href={`/market/items/${item.id}`} className="pressable flex items-center gap-3 py-4">
        {rank !== undefined && <span className="w-5 shrink-0 text-center text-label font-bold text-brand-ink tabular-nums">{rank}</span>}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-label font-bold text-ink">
            {item.courseName}
            {item.verified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="골프장 확인 매물" />}
          </span>
          <span className="mt-0.5 block truncate text-caption text-ink-mute">
            {MARKET_REGION_LABEL[item.region]} · {item.kind} · {item.holes}홀
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-label font-bold text-ink tabular-nums">
            {price === "ask" && <span className="mr-1 text-caption font-semibold text-brand-ink">즉시 구매</span>}
            {formatManWon(amount)}
          </span>
          <span className={`block text-caption font-semibold tabular-nums ${rateClass(rate)}`}>{formatRate(rate)}</span>
        </span>
      </Link>
    </li>
  );
}

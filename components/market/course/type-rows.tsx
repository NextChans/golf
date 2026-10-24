import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { currentPrice, formatManWon, formatRate, itemLabel, weeklyChangeRate, type MarketItem } from "@/lib/domain/market/schema";
import { cn } from "@/lib/utils";
import { rateClass } from "../ui";

/**
 * 회원권 유형 행 목록(검색 결과 카드·골프장 상세 공용, D-89).
 * 행 전체가 회원권 상세 링크. 접근성 이름에 골프장명·유형·가격·변화율이 모두 들어간다.
 */
export function TypeRows({ items, courseName, bordered = false, className }: {
  items: readonly MarketItem[]; courseName: string; bordered?: boolean; className?: string;
}) {
  return (
    <ul aria-label={`${courseName} 회원권 유형`} className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => {
        const rate = weeklyChangeRate(item.weekly);
        return (
          <li key={item.id}>
            <Link
              href={`/market/items/${item.id}`}
              className={cn(
                "pressable flex min-h-14 items-center gap-3 rounded-control bg-fill px-4 py-3",
                bordered && "border border-line",
              )}
            >
              <span className="min-w-0 flex-1 text-label font-semibold break-keep text-ink">
                <span className="sr-only">{courseName} </span>
                {itemLabel(item)}
              </span>
              <span className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-label font-bold text-ink">{formatManWon(currentPrice(item))}</span>
                <span className={cn("text-caption font-semibold", rateClass(rate))}>{formatRate(rate)}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-faint" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** 글자 아바타(골프장명 첫 글자, 로고 이미지 없음) */
export function CourseAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-card border border-line bg-surface font-semibold text-brand-ink",
        size === "lg" ? "size-14 text-subhead" : "size-12 text-subhead",
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

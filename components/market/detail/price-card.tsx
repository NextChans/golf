import { ArrowDown, Calculator } from "lucide-react";
import { formatManWon, formatRate } from "@/lib/domain/market/schema";
import { rateClass } from "../ui";
import { PriceInfo } from "./price-info";
import { ScrollLink } from "./scroll-link";

/** 가격 카드: 현재 시세·변화율, 즉시 구매가·즉시 판매가, 최근 거래가 + 거래 비용 바로가기 */
export function PriceCard({ quote, rate, askPrice, bidPrice, lastDeal }: {
  quote: number; rate: number; askPrice: number | null; bidPrice: number | null; lastDeal: number | null;
}) {
  return (
    <section aria-label="가격 정보" className="px-6 pt-5">
      <div className="rounded-card border border-line bg-fill px-5 py-4">
        <PriceInfo />
        <p className="text-display font-bold text-ink tabular-nums">
          {formatManWon(quote)} <span className={`text-label font-bold ${rateClass(rate)}`}>{formatRate(rate)}</span>
        </p>
        <hr className="my-4 border-line" />
        <dl className="grid grid-cols-2 gap-x-3">
          <div>
            <dt className="text-label font-semibold text-ink-sub">즉시 구매가</dt>
            <dd className="mt-1 text-subhead font-bold text-up tabular-nums">{askPrice !== null ? formatManWon(askPrice) : "매물 없음"}</dd>
          </div>
          <div>
            <dt className="text-label font-semibold text-ink-sub">즉시 판매가</dt>
            <dd className="mt-1 text-subhead font-bold text-down tabular-nums">{bidPrice !== null ? formatManWon(bidPrice) : "입찰 없음"}</dd>
          </div>
        </dl>
        <hr className="my-4 border-line" />
        <dl className="grid grid-cols-2 gap-x-3">
          <dt className="text-label font-semibold text-ink-sub">최근 거래가</dt>
          <dd className="text-label font-bold text-ink tabular-nums">{lastDeal !== null ? formatManWon(lastDeal) : "거래 없음"}</dd>
        </dl>
      </div>
      <ScrollLink
        to="calc"
        className="pressable mt-3 flex min-h-14 items-center gap-2 rounded-card bg-brand-soft px-4 text-label font-bold text-brand-ink"
      >
        <Calculator aria-hidden className="size-6 shrink-0" />
        <span className="flex-1">거래 비용 3초만에 계산해보기</span>
        <ArrowDown aria-hidden className="size-5 text-ink-mute" />
      </ScrollLink>
    </section>
  );
}

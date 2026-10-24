import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { FavoriteButton } from "@/components/market/favorites";
import { Sparkline } from "@/components/market/sparkline";
import { AppScreen, Divider, primaryButtonClass, rateClass, secondaryButtonClass, TopBar } from "@/components/market/ui";
import {
  brokerageFee, currentPrice, formatManWon, formatRate, MARKET_REGION_LABEL, weeklyChangeRate,
} from "@/lib/domain/market/schema";
import { FEE_POLICY, findMarketItem, MARKET_WEEK_LABEL } from "@/lib/mock/market";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const item = findMarketItem((await params).id);
  return { title: item?.courseName ?? "회원권" };
}

export default async function MarketItemPage({ params }: { params: Params }) {
  const item = findMarketItem((await params).id);
  if (!item) notFound();

  const quote = currentPrice(item);
  const rate = weeklyChangeRate(item.weekly);
  const min = Math.min(...item.weekly);
  const max = Math.max(...item.weekly);
  const buyFee = item.askPrice !== null ? brokerageFee(item.askPrice, item.kind, FEE_POLICY) : null;

  return (
    <AppScreen withTabBar={false} className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <TopBar title="회원권 정보" back="/market" right={<FavoriteButton id={item.id} name={item.courseName} />} />
      <main>
        <section className="px-6 pt-4 pb-8">
          <p className="text-caption font-semibold text-ink-mute">{MARKET_REGION_LABEL[item.region]} · {item.holes}홀</p>
          <h2 className="mt-1 flex items-center gap-1.5 text-heading font-extrabold text-ink">
            {item.courseName}
            {item.verified && <BadgeCheck className="size-5 text-brand" aria-label="골프장 확인 매물" />}
          </h2>
          <p className="text-label font-semibold text-ink-sub">{item.kind}</p>
          <p className="mt-5 text-caption font-semibold text-ink-mute">이번 주 시세</p>
          <p className="text-display font-extrabold text-ink tabular-nums">
            {formatManWon(quote)} <span className={cn("text-label font-bold", rateClass(rate))}>{formatRate(rate)}</span>
          </p>
          <Sparkline values={item.weekly} label={`최근 12주 시세 추이, 최저 ${formatManWon(min)}, 최고 ${formatManWon(max)}`} className="mt-5 h-auto w-full" />
          <div className="mt-2 flex justify-between text-caption text-ink-mute">
            <span>12주 최저 {formatManWon(min)}</span>
            <span>최고 {formatManWon(max)}</span>
          </div>
          <p className="mt-1 text-tiny text-ink-faint">{MARKET_WEEK_LABEL}</p>
        </section>

        <Divider />
        <section aria-labelledby="price-title" className="px-6 py-7">
          <h3 id="price-title" className="text-subhead font-bold text-ink">거래 가격</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-card bg-fill p-4">
              <dt className="text-caption font-semibold text-ink-mute">즉시 구매가</dt>
              <dd className="mt-1 text-subhead font-extrabold text-up tabular-nums">{item.askPrice !== null ? formatManWon(item.askPrice) : "매물 없음"}</dd>
            </div>
            <div className="rounded-card bg-fill p-4">
              <dt className="text-caption font-semibold text-ink-mute">즉시 판매가</dt>
              <dd className="mt-1 text-subhead font-extrabold text-down tabular-nums">{item.bidPrice !== null ? formatManWon(item.bidPrice) : "입찰 없음"}</dd>
            </div>
          </dl>
          {buyFee !== null && (
            <p className="mt-3 text-caption text-ink-mute">즉시 구매 시 예상 수수료 {formatManWon(buyFee)} (수수료 정찰제, 명의개서 비용 별도)</p>
          )}
        </section>

        <Divider />
        <section aria-labelledby="benefit-title" className="px-6 py-7">
          <h3 id="benefit-title" className="text-subhead font-bold text-ink">회원 혜택</h3>
          <ul className="mt-3 space-y-2">
            {item.benefits.map((b) => (
              <li key={b} className="flex gap-2 text-label text-ink-sub"><span aria-hidden className="text-brand">•</span>{b}</li>
            ))}
          </ul>
          <p className="mt-3 text-tiny text-ink-faint">혜택은 골프장 정책에 따라 바뀔 수 있습니다. 상담 때 최신 내용을 확인해 드립니다.</p>
        </section>

        <Divider />
        <Link href="/market/guide/guarantee" className="pressable flex items-center gap-3 px-6 py-6">
          <ShieldCheck className="size-8 shrink-0 text-brand" aria-hidden />
          <span>
            <span className="block text-label font-bold text-ink">안심 거래 보장</span>
            <span className="text-caption text-ink-mute">대금 보호부터 명의개서 완료까지 담당자가 함께합니다 ›</span>
          </span>
        </Link>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe">
        <div className="mx-auto grid max-w-[480px] grid-cols-2 gap-3 px-6 py-3">
          <Link href={`/market/mypage/asks/new?item=${item.id}`} className={secondaryButtonClass}>판매하기</Link>
          <Link href="/memberships" className={primaryButtonClass}>구매 상담</Link>
        </div>
      </div>
    </AppScreen>
  );
}

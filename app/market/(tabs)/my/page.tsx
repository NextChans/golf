import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppScreen, LoginPrompt, rateClass, TopBar } from "@/components/market/ui";
import { getSession } from "@/lib/auth/guards";
import { currentPrice, formatManWon, formatRate, MARKET_REGION_LABEL, weeklyChangeRate } from "@/lib/domain/market/schema";
import { findMarketItem, MY_HOLDINGS } from "@/lib/mock/market";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "나의 회원권" };

export default async function MyMembershipsPage() {
  const session = await getSession();
  const customer = session?.role === "customer";
  const holdings = customer
    ? MY_HOLDINGS.flatMap((h) => {
        const item = findMarketItem(h.itemId);
        return item ? [{ ...h, item }] : [];
      })
    : [];

  return (
    <AppScreen floating>
      <TopBar title="나의 회원권" />
      <main className="px-6 pt-6 pb-10">
        <h2 className="text-heading font-bold text-ink-sub">보유 회원권</h2>
        <div className="mt-5">
          {!customer ? (
            <LoginPrompt boxed href="/market/login?next=/market/my" lead="지금 " emphasis="내 회원권의 가치" tail="를 확인해보세요." />
          ) : (
            <ul className="space-y-3">
              {holdings.map(({ item, acquiredPrice }) => {
                const now = currentPrice(item);
                const rate = weeklyChangeRate(item.weekly);
                const gain = now - acquiredPrice;
                return (
                  <li key={item.id}>
                    <Link href={`/market/items/${item.id}`} className="pressable block rounded-card bg-fill p-6">
                      <span className="text-caption font-semibold text-ink-mute">{MARKET_REGION_LABEL[item.region]} · {item.kind}</span>
                      <span className="mt-0.5 block text-subhead font-bold text-ink">{item.courseName}</span>
                      <span className="mt-4 block text-caption text-ink-mute">현재 가치</span>
                      <span className="block text-heading font-bold tabular-nums">
                        {formatManWon(now)} <span className={cn("text-caption font-bold", rateClass(rate))}>{formatRate(rate)}</span>
                      </span>
                      <span className={cn("mt-1 block text-caption font-semibold tabular-nums", rateClass(gain))}>
                        취득가 대비 {gain >= 0 ? "+" : "-"}{formatManWon(Math.abs(gain))}
                      </span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/market/mypage/asks/new" className="pressable flex h-14 items-center justify-center gap-1 rounded-card border border-dashed border-line text-label font-semibold text-ink-sub">
                  <Plus className="size-5" aria-hidden /> 회원권 추가하기
                </Link>
              </li>
            </ul>
          )}
        </div>
      </main>
    </AppScreen>
  );
}

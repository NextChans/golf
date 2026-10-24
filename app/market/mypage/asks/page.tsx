import type { Metadata } from "next";
import Link from "next/link";
import { AppScreen, LoginPrompt, primaryButtonClass, StateView, TopBar } from "@/components/market/ui";
import { getSession } from "@/lib/auth/guards";
import { currentPrice, formatManWon } from "@/lib/domain/market/schema";
import { formatKst } from "@/lib/format/kst";
import { findMarketItem, MY_ASKS } from "@/lib/mock/market";

export const metadata: Metadata = { title: "판매 희망가" };

export default async function AsksPage() {
  const session = await getSession();
  const customer = session?.role === "customer";
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="판매 희망가" back="/market/mypage" />
      <main className="px-6 pt-4 pb-10">
        {!customer ? (
          <LoginPrompt boxed href="/login?next=/market/mypage/asks" lead="로그인하고 " emphasis="판매 희망가" tail="를 등록해 보세요." />
        ) : MY_ASKS.length === 0 ? (
          <StateView title="등록한 판매 희망가가 없어요" />
        ) : (
          <ul className="space-y-3">
            {MY_ASKS.map((a) => {
              const item = findMarketItem(a.itemId);
              if (!item) return null;
              return (
                <li key={a.id} className="rounded-card border border-line p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-label font-bold text-ink">{item.courseName}</p>
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-tiny font-bold text-brand-ink">{a.status}</span>
                  </div>
                  <p className="mt-2 text-heading font-extrabold tabular-nums">{formatManWon(a.price)}</p>
                  <p className="text-caption text-ink-mute">이번 주 시세 {formatManWon(currentPrice(item))} · {formatKst(a.createdAt)} 등록</p>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/market/mypage/asks/new" className={`${primaryButtonClass} mt-8 w-full`}>판매 희망가 등록</Link>
      </main>
    </AppScreen>
  );
}

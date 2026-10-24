import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { AppScreen, TopBar } from "@/components/market/ui";
import { formatManWon } from "@/lib/domain/market/schema";
import { COUPONS } from "@/lib/mock/market";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "쿠폰함" };

const ymd = (s: string) => s.replaceAll("-", ".");

export default function CouponsPage() {
  const usable = COUPONS.filter((c) => !c.used);
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="쿠폰함" back="/market/mypage" />
      <main className="px-6 pt-4 pb-10">
        <p className="text-label font-semibold text-ink-sub">사용 가능한 쿠폰 <b className="text-brand-ink">{usable.length}장</b></p>
        <ul className="mt-4 space-y-3">
          {COUPONS.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-4 rounded-card border border-line p-5", c.used && "opacity-50")}>
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Ticket className="size-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-label font-bold text-ink">{c.title}</span>
                <span className="text-caption text-ink-mute">
                  {c.used ? "사용 완료" : `${ymd(c.expiresOn)}까지`}
                  {c.minPrice > 0 && ` · ${formatManWon(c.minPrice)} 이상 거래`}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-tiny text-ink-faint">쿠폰은 계약 성사 후 수수료 정산 때 담당자가 적용합니다. 쿠폰끼리 중복 적용되지 않습니다.</p>
      </main>
    </AppScreen>
  );
}

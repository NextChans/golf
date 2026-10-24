import type { Metadata } from "next";
import { AppScreen, StateView, TopBar } from "@/components/market/ui";
import { formatKst } from "@/lib/format/kst";
import { NOTIFICATIONS } from "@/lib/mock/market";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "알림" };

export default function NotificationsPage() {
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="알림" back="/market" />
      <main className="pb-10">
        {NOTIFICATIONS.length === 0 ? (
          <StateView title="새 알림이 없어요" />
        ) : (
          <ul className="divide-y divide-line">
            {NOTIFICATIONS.map((n) => (
              <li key={n.id} className={cn("px-6 py-5", !n.read && "bg-brand-soft/50")}>
                <p className="text-caption font-semibold text-brand-ink">
                  {n.kind}{!n.read && <span className="ml-1.5 text-up">• 새 알림</span>}
                </p>
                <p className="mt-0.5 text-label font-bold text-ink">{n.title}</p>
                <p className="text-caption text-ink-sub">{n.body}</p>
                <p className="mt-1 text-tiny text-ink-faint">{formatKst(n.at)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppScreen>
  );
}

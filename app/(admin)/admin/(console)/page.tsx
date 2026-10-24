import type { Metadata } from "next";
import Link from "next/link";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { DEAL_OPEN_STATUSES } from "@/lib/domain/membership/deal-admin";

export const metadata: Metadata = { title: "운영자 홈", robots: { index: false } };

export default async function AdminHome() {
  const session = await requireStaff();
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count);
  const deals = () => supabase.from("membership_deals").select("id", { count: "exact", head: true });
  const [fresh, mine, failed, reports, review] = await Promise.all([
    count(deals().eq("status", "inquiry")),
    count(deals().eq("assignee_id", session.userId).in("status", DEAL_OPEN_STATUSES)),
    count(supabase.from("notification_outbox").select("id", { count: "exact", head: true }).in("status", ["failed", "dead"])),
    count(supabase.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(supabase.from("groups").select("id", { count: "exact", head: true }).eq("status", "review")),
  ]);

  const tiles = [
    { href: "/admin/deals?tab=new", title: "신규 회원권 상담", value: fresh },
    { href: "/admin/deals?tab=mine", title: "내 담당 상담", value: mine },
    { href: "/admin/notifications", title: "알림 재시도·실패", value: failed, alert: (failed ?? 0) > 0 },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title tracking-tight">운영자 홈</h1>
        <p className="mt-2 text-body text-muted-foreground">오늘 처리할 회원권 상담과 모임·알림을 한곳에서 확인합니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="pressable block rounded-tile-lg">
            <Tile className="p-6 hover:bg-border/40">
              <p className="text-small text-muted-foreground">{t.title}</p>
              <p className={`mt-1 text-headline font-semibold tabular-nums ${"alert" in t && t.alert ? "text-destructive" : ""}`}>
                {t.value ?? "-"}
              </p>
            </Tile>
          </Link>
        ))}
        <Link href="/admin/community" className="pressable block rounded-tile-lg" aria-label={`커뮤니티 신고 ${reports ?? "-"}건, 검수 대기 ${review ?? "-"}건`}>
          <Tile className="p-6 hover:bg-border/40">
            <p className="text-small text-muted-foreground">커뮤니티 신고·검수</p>
            <p className={`mt-1 text-headline font-semibold tabular-nums ${(reports ?? 0) + (review ?? 0) > 0 ? "text-destructive" : ""}`}>
              {reports ?? "-"}
              <span className="text-body font-normal text-muted-foreground"> / {review ?? "-"}</span>
            </p>
            <p className="mt-1 text-micro text-muted-foreground">열린 신고 / 검수 대기 모임</p>
          </Tile>
        </Link>
      </div>
    </div>
  );
}

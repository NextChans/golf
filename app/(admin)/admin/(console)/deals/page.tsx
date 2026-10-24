import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { formatKst } from "@/lib/format/kst";
import { maskPhone } from "@/lib/domain/phone";
import { formatWon } from "@/lib/format/money";
import { DEAL_SIDE_LABEL, DEAL_STATUS_LABEL, type DealSide, type DealStatus } from "@/lib/domain/membership/status";
import { DEAL_OPEN_STATUSES, DEAL_TABS, DEAL_TAB_LABEL, parseDealTab, type DealTab } from "@/lib/domain/membership/deal-admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "회원권 상담", robots: { index: false } };

const LIMIT = 100;
const SELECT = `id, side, status, desired_price, agreed_price, created_at, assignee_id,
  membership_products(name),
  membership_listings(asking_price),
  customer:profiles!membership_deals_user_id_fkey(display_name, phone),
  assignee:profiles!membership_deals_assignee_id_fkey(display_name)`;

type Supabase = Awaited<ReturnType<typeof createClient>>;

function query(supabase: Supabase, tab: DealTab, me: string, select: string, head = false) {
  let q = supabase.from("membership_deals").select(select, head ? { count: "exact", head: true } : undefined);
  switch (tab) {
    case "new": q = q.eq("status", "inquiry"); break;
    case "mine": q = q.eq("assignee_id", me).in("status", DEAL_OPEN_STATUSES); break;
    case "open": q = q.in("status", DEAL_OPEN_STATUSES); break;
    case "all": break;
  }
  return q;
}

export default async function DealInboxPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireStaff();
  const tab = parseDealTab((await searchParams).tab);
  const supabase = await createClient();

  const [list, newCount, mineCount] = await Promise.all([
    query(supabase, tab, session.userId, SELECT).order("created_at", { ascending: tab !== "all" }).limit(LIMIT),
    query(supabase, "new", session.userId, "id", true),
    query(supabase, "mine", session.userId, "id", true),
  ]);
  const countOf: Partial<Record<DealTab, number | null>> = { new: newCount.count, mine: mineCount.count };
  const rows = (list.data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title tracking-tight">회원권 상담</h1>
        <p className="mt-2 text-body text-muted-foreground">매수·매도 상담을 협의하고 계약·명의개서까지 단계를 관리합니다.</p>
      </div>

      <nav aria-label="상담 필터" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {DEAL_TABS.map((t) => (
            <li key={t}>
              <Link
                href={`/admin/deals?tab=${t}`}
                aria-current={t === tab ? "page" : undefined}
                className={cn(
                  "pressable inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-small whitespace-nowrap",
                  t === tab ? "bg-foreground text-background" : "bg-section text-foreground hover:bg-border/60",
                )}
              >
                {DEAL_TAB_LABEL[t]}
                {countOf[t] != null && <span className="tabular-nums">{countOf[t]}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {list.error ? (
        <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">
          상담 목록을 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      ) : rows.length === 0 ? (
        <Tile className="p-8 text-center md:p-12">
          <p className="text-eyebrow tracking-tight">{DEAL_TAB_LABEL[tab]} 건이 없습니다</p>
          <p className="mt-2 text-small text-muted-foreground">새 상담이 들어오면 여기에 표시됩니다.</p>
        </Tile>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
          {rows.map((r) => {
            const price = r.agreed_price ?? r.desired_price ?? r.membership_listings?.asking_price ?? null;
            return (
              <li key={r.id}>
                <Link href={`/admin/deals/${r.id}`} className="pressable flex items-start justify-between gap-3 px-5 py-4 hover:bg-section/60">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-body font-semibold">
                      <span className="mr-1.5 text-primary">{DEAL_SIDE_LABEL[r.side]}</span>
                      {r.membership_products?.name ?? "상품 미정"}
                    </p>
                    <p className="text-small text-muted-foreground">{price == null ? "가격 미정" : formatWon(price)}</p>
                    <p className="text-micro text-muted-foreground">
                      {r.customer?.display_name ?? "고객"} · <span className="tabular-nums">{maskPhone(r.customer?.phone)}</span>
                      {" · "}담당 {r.assignee?.display_name ?? "미배정"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant={r.status === "cancelled" ? "outline" : r.status === "inquiry" ? "secondary" : "default"}>
                      {DEAL_STATUS_LABEL[r.status]}
                    </Badge>
                    <span className="text-micro text-muted-foreground tabular-nums">{formatKst(r.created_at)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length === LIMIT && <p className="text-micro text-muted-foreground">최근 {LIMIT}건까지 표시합니다.</p>}
    </div>
  );
}

type Row = {
  id: string;
  side: DealSide;
  status: DealStatus;
  desired_price: number | null;
  agreed_price: number | null;
  created_at: string;
  assignee_id: string | null;
  membership_products: { name: string } | null;
  membership_listings: { asking_price: number } | null;
  customer: { display_name: string | null; phone: string | null } | null;
  assignee: { display_name: string | null } | null;
};

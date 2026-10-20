import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { formatKst, formatKstDate } from "@/lib/format/kst";
import { maskPhone } from "@/lib/domain/phone";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT, TIME_PREF_LABEL } from "@/lib/domain/booking/status";
import { INBOX_TABS, INBOX_TAB_LABEL, OPEN_STATUSES, parseInboxTab, type InboxTab } from "@/lib/domain/booking/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "요청 인박스", robots: { index: false } };

const LIMIT = 100;
const SELECT = `id, status, play_date, time_pref, players, course_name_free, created_at, sla_due_at, sla_breached_at, assignee_id,
  golf_courses(name),
  customer:profiles!booking_requests_user_id_fkey(display_name, phone),
  assignee:profiles!booking_requests_assignee_id_fkey(display_name)`;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 탭별 조건. 대기열(신규·SLA·진행 중·내 담당)은 오래된 순, 전체는 최신순
function query(supabase: Supabase, tab: InboxTab, me: string, nowIso: string, select: string, head = false) {
  let q = supabase.from("booking_requests").select(select, head ? { count: "exact", head: true } : undefined);
  switch (tab) {
    case "new": q = q.eq("status", "requested"); break;
    case "sla": q = q.eq("status", "requested").lt("sla_due_at", nowIso); break;
    case "mine": q = q.eq("assignee_id", me).in("status", OPEN_STATUSES); break;
    case "open": q = q.in("status", OPEN_STATUSES); break;
    case "all": break;
  }
  return q;
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireStaff();
  const tab = parseInboxTab((await searchParams).tab);
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [list, newCount, mineCount, slaCount] = await Promise.all([
    query(supabase, tab, session.userId, nowIso, SELECT)
      .order("created_at", { ascending: tab !== "all" })
      .limit(LIMIT),
    query(supabase, "new", session.userId, nowIso, "id", true),
    query(supabase, "mine", session.userId, nowIso, "id", true),
    query(supabase, "sla", session.userId, nowIso, "id", true),
  ]);
  const countOf: Partial<Record<InboxTab, number | null>> = { new: newCount.count, mine: mineCount.count, sla: slaCount.count };
  // select 문자열을 함수 인자로 넘겨 타입 추론이 풀리므로 결과 형태를 명시한다
  const rows = (list.data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title tracking-tight">요청 인박스</h1>
        <p className="mt-2 text-body text-muted-foreground">접수된 부킹 요청을 배정하고 티타임을 제안합니다.</p>
      </div>

      <nav aria-label="인박스 필터" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {INBOX_TABS.map((t) => (
            <li key={t}>
              <Link
                href={`/admin/bookings?tab=${t}`}
                aria-current={t === tab ? "page" : undefined}
                className={cn(
                  "pressable inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-small whitespace-nowrap",
                  t === tab ? "bg-foreground text-background" : "bg-section text-foreground hover:bg-border/60",
                )}
              >
                {INBOX_TAB_LABEL[t]}
                {countOf[t] != null && (
                  <span className={cn("tabular-nums", t === "sla" && countOf[t]! > 0 && t !== tab && "text-destructive font-semibold")}>
                    {countOf[t]}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {list.error ? (
        <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">
          요청 목록을 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      ) : rows.length === 0 ? (
        <Tile className="p-8 text-center md:p-12">
          <p className="text-eyebrow tracking-tight">{INBOX_TAB_LABEL[tab]} 요청이 없습니다</p>
          <p className="mt-2 text-small text-muted-foreground">새 요청이 들어오면 여기에 표시됩니다.</p>
        </Tile>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
          {rows.map((r) => {
            const breached = r.status === "requested" && Date.parse(r.sla_due_at) < Date.parse(nowIso);
            const course = r.golf_courses?.name ?? r.course_name_free ?? "골프장 미정";
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/bookings/${r.id}`}
                  className="pressable flex items-start justify-between gap-3 px-5 py-4 hover:bg-section/60"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-body font-semibold">{course}</p>
                    <p className="text-small text-muted-foreground">
                      {formatKstDate(r.play_date)} · {TIME_PREF_LABEL[r.time_pref]} · {r.players}명
                    </p>
                    <p className="text-micro text-muted-foreground">
                      {r.customer?.display_name ?? "고객"} · <span className="tabular-nums">{maskPhone(r.customer?.phone)}</span>
                      {" · "}담당 {r.assignee?.display_name ?? "미배정"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant={BOOKING_STATUS_VARIANT[r.status]}>{BOOKING_STATUS_LABEL[r.status]}</Badge>
                    {breached ? (
                      <Badge variant="destructive">SLA 초과</Badge>
                    ) : (
                      <span className="text-micro text-muted-foreground tabular-nums">{formatKst(r.created_at)}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length === LIMIT && (
        <p className="text-micro text-muted-foreground">최근 {LIMIT}건까지 표시합니다. 탭을 좁혀 확인해 주세요.</p>
      )}
    </div>
  );
}

type Row = {
  id: string;
  status: keyof typeof BOOKING_STATUS_LABEL;
  play_date: string;
  time_pref: keyof typeof TIME_PREF_LABEL;
  players: number;
  course_name_free: string | null;
  created_at: string;
  sla_due_at: string;
  sla_breached_at: string | null;
  assignee_id: string | null;
  golf_courses: { name: string } | null;
  customer: { display_name: string | null; phone: string | null } | null;
  assignee: { display_name: string | null } | null;
};

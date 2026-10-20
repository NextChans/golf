import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { formatKst } from "@/lib/format/kst";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "알림 발송", robots: { index: false } };

const STATUS_LABEL = { pending: "대기", sending: "발송 중", sent: "발송됨", failed: "재시도 대기", dead: "실패" } as const;
const CHANNEL_LABEL = { alimtalk: "알림톡", sms: "SMS", slack: "Slack", email: "이메일" } as const;

/** 발송 현황(N-01): 최근 24시간 상태별 건수, 재시도 대기·실패 목록. 수신자 연락처는 보여 주지 않는다 */
export default async function NotificationsPage() {
  await requireStaff();
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const head = (status: keyof typeof STATUS_LABEL) =>
    supabase.from("notification_outbox").select("id", { count: "exact", head: true }).eq("status", status).gte("created_at", since);

  const [problems, ...counts] = await Promise.all([
    supabase
      .from("notification_outbox")
      .select("id, template_code, recipient_kind, channel, status, attempts, last_error, next_attempt_at, created_at")
      .in("status", ["failed", "dead"])
      .order("created_at", { ascending: false })
      .limit(50),
    head("sent"), head("pending"), head("failed"), head("dead"),
  ]);
  const [sent, pending, failed, dead] = counts.map((c) => c.count);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title tracking-tight">알림 발송</h1>
        <p className="mt-2 text-body text-muted-foreground">
          고객 알림(알림톡, 실패 시 SMS)과 운영자 알림(Slack)의 발송 상태입니다. 실패하면 1·2·4·8분 뒤 다시 보내고, 5번 실패하면 멈춥니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["발송됨", sent], ["대기", pending], ["재시도 대기", failed], ["실패", dead]] as const).map(([label, v]) => (
          <Tile key={label} className="p-5">
            <p className="text-small text-muted-foreground">{label} · 24시간</p>
            <p className={`mt-1 text-title font-semibold tabular-nums ${label === "실패" && (v ?? 0) > 0 ? "text-destructive" : ""}`}>{v ?? "-"}</p>
          </Tile>
        ))}
      </div>

      <section aria-labelledby="problems-title" className="space-y-3">
        <h2 id="problems-title" className="text-eyebrow tracking-tight">재시도 대기·실패</h2>
        {problems.error ? (
          <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">목록을 불러오지 못했습니다.</p>
        ) : !problems.data?.length ? (
          <Tile className="p-6"><p className="text-body text-muted-foreground">실패한 알림이 없습니다.</p></Tile>
        ) : (
          <ul aria-label="실패 알림 목록" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
            {problems.data.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-semibold">{n.template_code}</p>
                    <Badge variant={n.status === "dead" ? "destructive" : "secondary"}>{STATUS_LABEL[n.status]}</Badge>
                  </div>
                  <p className="text-micro text-muted-foreground tabular-nums">
                    #{n.id} · {n.recipient_kind === "admins" ? "운영자" : "고객"} · {CHANNEL_LABEL[n.channel]} · 시도 {n.attempts}회 · 생성 {formatKst(n.created_at)}
                    {n.status === "failed" && ` · 다음 시도 ${formatKst(n.next_attempt_at)}`}
                  </p>
                  {n.last_error && <p className="break-all text-micro text-destructive">{n.last_error}</p>}
                </div>
                {n.status === "dead" && <RetryButton id={n.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

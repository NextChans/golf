import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerHeader } from "@/components/customer/customer-header";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { formatKst, formatKstDate } from "@/lib/format/kst";
import { formatWon } from "@/lib/domain/booking/money";
import {
  BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT, customerActions, describeTimePref,
} from "@/lib/domain/booking/status";
import { ProposalCard } from "./proposal-card";
import { CancelBookingButton } from "./cancel-button";

export const metadata: Metadata = { title: "예약 상세" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // 요청·제안·타임라인을 한 번에 조회(N+1 없음). RLS가 본인 요청이 아니면 0행을 돌려준다.
  const { data: b, error } = await supabase
    .from("booking_requests")
    .select(`id, status, version, play_date, time_pref, time_from, time_to, players, budget_per_person, note,
      course_name_free, close_reason, created_at, golf_courses(name),
      booking_proposals(id, status, tee_time, green_fee_per_person, memo, expires_at, created_at),
      booking_events(id, to_status, message, created_at)`)
    .eq("id", id)
    .order("created_at", { referencedTable: "booking_proposals", ascending: false })
    .order("id", { referencedTable: "booking_events", ascending: true })
    .maybeSingle();

  if (error) throw new Error("booking detail query failed");
  if (!b) notFound();

  const offered = b.booking_proposals.find((p) => p.status === "offered") ?? null;
  const accepted = b.booking_proposals.find((p) => p.status === "accepted") ?? null;
  const actions = customerActions(b.status, !!offered);

  return (
    <>
      <CustomerHeader />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <Link href="/bookings" className="text-sm text-muted-foreground">← 내 예약</Link>
        <section className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold">{b.golf_courses?.name ?? b.course_name_free ?? "골프장 미정"}</h1>
            <Badge variant={BOOKING_STATUS_VARIANT[b.status]} data-testid="booking-status">{BOOKING_STATUS_LABEL[b.status]}</Badge>
          </div>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">날짜</dt><dd>{formatKstDate(b.play_date)}</dd>
            <dt className="text-muted-foreground">시간대</dt><dd>{describeTimePref(b.time_pref, b.time_from, b.time_to)}</dd>
            <dt className="text-muted-foreground">인원</dt><dd>{b.players}명</dd>
            <dt className="text-muted-foreground">예산</dt><dd>{b.budget_per_person == null ? "-" : `1인 ${formatWon(b.budget_per_person)}`}</dd>
            {b.note && (<><dt className="text-muted-foreground">요청사항</dt><dd className="whitespace-pre-wrap">{b.note}</dd></>)}
          </dl>
          {b.close_reason && <p className="rounded-lg bg-muted px-3 py-2 text-sm">사유: {b.close_reason}</p>}
        </section>

        {offered && actions.canAccept && (
          <ProposalCard
            requestVersion={b.version}
            players={b.players}
            proposal={offered}
            // 수락 멱등키는 렌더마다 새로 발급(같은 화면에서의 중복 클릭은 같은 키)
            idempotencyKey={randomUUID()}
            serverNow={Date.now()}
          />
        )}

        {accepted && b.status === "confirmed" && (
          <section className="rounded-xl border border-primary/40 bg-secondary p-4" aria-label="확정된 티타임">
            <p className="text-sm text-muted-foreground">확정된 티타임</p>
            <p className="text-lg font-bold">{formatKst(accepted.tee_time)}</p>
            <p className="text-sm">그린피 1인 {formatWon(accepted.green_fee_per_person)}</p>
            <p className="mt-2 text-xs text-muted-foreground">확정 후 취소는 골프장 위약 규정에 따라 담당자에게 문의해 주세요.</p>
          </section>
        )}

        <section aria-labelledby="timeline-title" className="space-y-2">
          <h2 id="timeline-title" className="font-semibold">진행 상황</h2>
          <ol className="relative space-y-3 border-l pl-4">
            {b.booking_events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" aria-hidden />
                <p>{e.message ?? BOOKING_STATUS_LABEL[e.to_status]}</p>
                <p className="text-xs text-muted-foreground">{formatKst(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </section>

        {actions.canCancel && <CancelBookingButton requestId={b.id} version={b.version} />}
      </main>
    </>
  );
}

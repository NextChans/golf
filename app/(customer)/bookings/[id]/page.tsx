import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
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
  const courseName = b.golf_courses?.name ?? b.course_name_free ?? "골프장 미정";
  const timeText = describeTimePref(b.time_pref, b.time_from, b.time_to);

  return (
    <>
      <GlobalNav />
      <LocalNav title={courseName} />
      <main>
        {/* 히어로 헤더 */}
        <div className="mx-auto max-w-[1024px] px-4 pt-8 pb-10 md:pt-12 md:pb-14">
          <Link
            href="/bookings"
            className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4"
          >
            <span aria-hidden className="text-[1.1em] leading-none">‹</span>내 예약
          </Link>
          <p className="mt-4 text-eyebrow text-muted-foreground">
            {formatKstDate(b.play_date)} · {timeText}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-title font-semibold tracking-tight md:text-headline">{courseName}</h1>
            <Badge variant={BOOKING_STATUS_VARIANT[b.status]} data-testid="booking-status" className="px-3 py-1 text-small">
              {BOOKING_STATUS_LABEL[b.status]}
            </Badge>
          </div>
        </div>

        <div className="bg-section py-10 md:py-16">
          <div className="mx-auto grid max-w-[1024px] gap-4 px-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-6">
            <div className="flex flex-col gap-4 md:gap-6">
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
                <section
                  className="rounded-tile-lg bg-primary p-7 text-primary-foreground md:p-10"
                  aria-label="확정된 티타임"
                >
                  <p className="text-small font-semibold opacity-80">확정된 티타임</p>
                  <p className="mt-2 text-title font-semibold tracking-tight tabular-nums md:text-headline">
                    {formatKst(accepted.tee_time)}
                  </p>
                  <p className="mt-3 text-body">그린피 1인 {formatWon(accepted.green_fee_per_person)}</p>
                  <p className="mt-5 text-micro opacity-80">확정 후 취소는 골프장 위약 규정에 따라 담당자에게 문의해 주세요.</p>
                </section>
              )}

              <Tile className="bg-card p-6 md:p-8">
                <h2 className="text-eyebrow font-semibold tracking-tight">요청 내용</h2>
                <dl className="mt-4 divide-y divide-border/70 text-body">
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">날짜</dt><dd>{formatKstDate(b.play_date)}</dd>
                  </div>
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">시간대</dt><dd>{timeText}</dd>
                  </div>
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">인원</dt><dd>{b.players}명</dd>
                  </div>
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">예산</dt>
                    <dd>{b.budget_per_person == null ? "-" : `1인 ${formatWon(b.budget_per_person)}`}</dd>
                  </div>
                  {b.note && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-20 shrink-0 text-muted-foreground">요청사항</dt>
                      <dd className="min-w-0 whitespace-pre-wrap">{b.note}</dd>
                    </div>
                  )}
                </dl>
                {b.close_reason && (
                  <p className="mt-4 rounded-tile bg-section px-4 py-3 text-small">사유: {b.close_reason}</p>
                )}
              </Tile>

              {actions.canCancel && <CancelBookingButton requestId={b.id} version={b.version} />}
            </div>

            <Tile className="bg-card p-6 md:p-8">
              <section aria-labelledby="timeline-title">
                <h2 id="timeline-title" className="text-eyebrow font-semibold tracking-tight">진행 상황</h2>
                <ol className="mt-5">
                  {b.booking_events.map((e, i) => {
                    const last = i === b.booking_events.length - 1;
                    return (
                      <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {!last && <span aria-hidden className="absolute top-4 bottom-0 left-[4.5px] w-px bg-border" />}
                        <span
                          aria-hidden
                          className={`relative mt-[7px] size-2.5 shrink-0 rounded-full ${last ? "bg-primary" : "bg-muted-foreground/50"}`}
                        />
                        <div className="min-w-0">
                          <p className={`text-body ${last ? "font-semibold" : ""}`}>{e.message ?? BOOKING_STATUS_LABEL[e.to_status]}</p>
                          <p className="mt-0.5 text-micro text-muted-foreground tabular-nums">{formatKst(e.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </Tile>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

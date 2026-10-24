import type { Metadata } from "next";
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
import { formatWon } from "@/lib/format/money";
import { formatKoreanPrice } from "@/lib/domain/membership/schema";
import {
  customerCanCancel, DEAL_SIDE_LABEL, DEAL_STAGES, DEAL_STATUS_LABEL, DEAL_STATUS_VARIANT, stageIndex,
} from "@/lib/domain/membership/status";
import { cn } from "@/lib/utils";
import { CancelDealButton } from "./cancel-button";

export const metadata: Metadata = { title: "거래 상세" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // 거래·상품·매물·타임라인을 한 번에 조회(N+1 없음). RLS가 본인 거래가 아니면 0행을 돌려준다.
  const { data: d, error } = await supabase
    .from("membership_deals")
    .select(`id, side, status, version, desired_price, agreed_price, contract_date, contact_window, note,
      close_reason, created_at, listing_id,
      membership_products(name, kind, golf_courses(name)),
      membership_listings(asking_price),
      deal_events(id, from_status, to_status, message, created_at)`)
    .eq("id", id)
    .order("id", { referencedTable: "deal_events", ascending: true })
    .maybeSingle();

  if (error) throw new Error("deal detail query failed");
  if (!d) notFound();

  const productName = d.membership_products?.name ?? "회원권";
  const cancelled = d.status === "cancelled";
  // 취소된 거래는 취소 직전 단계까지 진행한 것으로 표시한다
  const cancelledFrom = cancelled ? d.deal_events.findLast((e) => e.to_status === "cancelled")?.from_status ?? "inquiry" : null;
  const current = stageIndex(cancelledFrom ?? d.status);

  return (
    <>
      <GlobalNav />
      <LocalNav title={productName} />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-8 pb-10 md:pt-12 md:pb-14">
          <Link
            href="/deals"
            className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4"
          >
            <span aria-hidden className="text-[1.1em] leading-none">‹</span>내 거래
          </Link>
          <p className="mt-4 text-eyebrow text-muted-foreground">
            {DEAL_SIDE_LABEL[d.side]} 상담 · {formatKst(d.created_at)} 신청
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-title font-semibold tracking-tight md:text-headline">{productName}</h1>
            <Badge variant={DEAL_STATUS_VARIANT[d.status]} data-testid="deal-status" className="px-3 py-1 text-small">
              {DEAL_STATUS_LABEL[d.status]}
            </Badge>
          </div>
        </div>

        <div className="bg-section py-10 md:py-16">
          <div className="mx-auto grid max-w-[1024px] gap-4 px-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-6">
            <div className="flex flex-col gap-4 md:gap-6">
              {/* 진행 단계 */}
              <Tile className="bg-card p-6 md:p-8">
                <h2 id="stages-title" className="text-eyebrow font-semibold tracking-tight">진행 단계</h2>
                <ol aria-labelledby="stages-title" className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
                  {DEAL_STAGES.map((s, i) => {
                    const done = i < current || (i === current && d.status === "completed");
                    const isCurrent = !cancelled && i === current;
                    return (
                      <li
                        key={s}
                        aria-current={isCurrent ? "step" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-small sm:flex-col sm:items-start sm:gap-1.5",
                          isCurrent ? "border-2 border-primary px-[13px] py-[11px] font-semibold"
                            : done ? "border-transparent bg-section" : "border-border text-muted-foreground",
                          cancelled && "opacity-60",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-micro tabular-nums",
                            done || isCurrent ? "bg-primary text-primary-foreground" : "bg-section text-muted-foreground",
                          )}
                        >
                          {done && !isCurrent ? "✓" : i + 1}
                        </span>
                        <span>{DEAL_STATUS_LABEL[s]}</span>
                        <span className="sr-only">{done ? "(완료)" : isCurrent ? "(현재 단계)" : ""}</span>
                      </li>
                    );
                  })}
                </ol>
                {cancelled && (
                  <div role="status" className="mt-5 rounded-tile bg-section px-4 py-3 text-body">
                    <p className="font-semibold">취소된 상담입니다</p>
                    {d.close_reason && <p className="mt-1 text-small text-muted-foreground">사유: {d.close_reason}</p>}
                  </div>
                )}
              </Tile>

              <Tile className="bg-card p-6 md:p-8">
                <h2 className="text-eyebrow font-semibold tracking-tight">상담 내용</h2>
                <dl className="mt-4 divide-y divide-border/70 text-body">
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-24 shrink-0 text-muted-foreground">구분</dt><dd>{DEAL_SIDE_LABEL[d.side]}</dd>
                  </div>
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-24 shrink-0 text-muted-foreground">회원권</dt>
                    <dd className="min-w-0">
                      {d.listing_id ? <Link href={`/memberships/${d.listing_id}`} className="text-primary hover:underline underline-offset-4">{productName}</Link> : productName}
                    </dd>
                  </div>
                  {d.membership_listings && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-24 shrink-0 text-muted-foreground">매물 호가</dt>
                      <dd className="tabular-nums">{formatWon(d.membership_listings.asking_price)}</dd>
                    </div>
                  )}
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-24 shrink-0 text-muted-foreground">희망가</dt>
                    <dd className="tabular-nums">{d.desired_price == null ? "-" : `${formatWon(d.desired_price)} (${formatKoreanPrice(d.desired_price)})`}</dd>
                  </div>
                  {d.agreed_price != null && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-24 shrink-0 text-muted-foreground">합의가</dt>
                      <dd className="font-semibold tabular-nums">{formatWon(d.agreed_price)}</dd>
                    </div>
                  )}
                  {d.contract_date && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-24 shrink-0 text-muted-foreground">계약일</dt>
                      <dd className="font-semibold">{formatKstDate(d.contract_date)}</dd>
                    </div>
                  )}
                  {d.contact_window && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-24 shrink-0 text-muted-foreground">연락 가능</dt><dd className="min-w-0">{d.contact_window}</dd>
                    </div>
                  )}
                  {d.note && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-24 shrink-0 text-muted-foreground">요청사항</dt>
                      <dd className="min-w-0 whitespace-pre-wrap">{d.note}</dd>
                    </div>
                  )}
                </dl>
              </Tile>

              {customerCanCancel(d.status) ? (
                <CancelDealButton dealId={d.id} version={d.version} />
              ) : !cancelled && d.status !== "completed" ? (
                <p className="text-center text-small text-muted-foreground">계약 단계 이후의 취소는 담당자에게 문의해 주세요.</p>
              ) : null}
            </div>

            <Tile className="bg-card p-6 md:p-8">
              <section aria-labelledby="timeline-title">
                <h2 id="timeline-title" className="text-eyebrow font-semibold tracking-tight">진행 상황</h2>
                <ol className="mt-5">
                  {d.deal_events.map((e, i) => {
                    const last = i === d.deal_events.length - 1;
                    return (
                      <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {!last && <span aria-hidden className="absolute top-4 bottom-0 left-[4.5px] w-px bg-border" />}
                        <span
                          aria-hidden
                          className={`relative mt-[7px] size-2.5 shrink-0 rounded-full ${last ? "bg-primary" : "bg-muted-foreground/50"}`}
                        />
                        <div className="min-w-0">
                          <p className={`text-body ${last ? "font-semibold" : ""}`}>{e.message ?? DEAL_STATUS_LABEL[e.to_status]}</p>
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

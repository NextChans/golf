import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
import { ActivityNoteForm } from "@/components/admin/activity-note-form";
import { ActivityNotes, fetchNoteAuthors } from "@/components/admin/activity-notes";
import { createClient } from "@/lib/supabase/server";
import { logPiiView } from "@/lib/admin/pii";
import { requireStaff } from "@/lib/auth/guards";
import { formatKst, formatKstDate } from "@/lib/format/kst";
import { formatPhone } from "@/lib/domain/phone";
import { formatWon } from "@/lib/domain/booking/money";
import { DEAL_SIDE_LABEL, DEAL_STATUS_LABEL } from "@/lib/domain/membership/status";
import { DEAL_FLOW, advanceBlocker, dealAdminActions, nextDealStatus } from "@/lib/domain/membership/deal-admin";
import { cn } from "@/lib/utils";
import { DealAssignForm, DealCancelForm, DealProgressButton, DealTermsForm } from "./deal-forms";

export const metadata: Metadata = { title: "상담 상세", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTING_STATUS_LABEL = { listed: "공개", reserved: "상담 중", sold: "판매완료", hidden: "비공개" } as const;

export default async function AdminDealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: d, error }, { data: staff }, { data: notes }] = await Promise.all([
    supabase
      .from("membership_deals")
      .select(`id, user_id, side, status, version, desired_price, agreed_price, contract_date, contact_window, note,
        close_reason, created_at, assignee_id, listing_id,
        membership_products(name, kind, golf_courses(name)),
        membership_listings(id, asking_price, status),
        customer:profiles!membership_deals_user_id_fkey(display_name, phone, phone_verified_at),
        assignee:profiles!membership_deals_assignee_id_fkey(display_name),
        deal_events(id, to_status, message, created_at)`)
      .eq("id", id)
      .order("id", { referencedTable: "deal_events", ascending: true })
      .maybeSingle(),
    supabase.rpc("list_assignable_staff"),
    supabase
      .from("activity_notes")
      .select("id, subject_type, subject_id, body, author_id, created_at")
      .eq("subject_type", "deal")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error("admin deal detail query failed");
  if (!d) notFound();

  // 상세 화면은 고객 전체 번호를 보여 주므로 열람을 기록한다(D-75)
  const [authors] = await Promise.all([fetchNoteAuthors(supabase, notes ?? []), logPiiView(supabase, "deal", d.id)]);
  const actions = dealAdminActions(d.status, { isAssignee: d.assignee_id === session.userId, isOwner: session.role === "owner" });
  const next = nextDealStatus(d.status);
  const blocker = next ? advanceBlocker(next, d) : null;
  const product = d.membership_products;
  const stepIndex = (DEAL_FLOW as readonly string[]).indexOf(d.status);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/deals" className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4">
          <span aria-hidden className="text-[1.1em] leading-none">‹</span>회원권 상담
        </Link>
        <p className="mt-2 text-small text-muted-foreground">{DEAL_SIDE_LABEL[d.side]} 상담 · 접수 {formatKst(d.created_at)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-title tracking-tight">{product?.name ?? "상품 미정"}</h1>
          <Badge variant={d.status === "cancelled" ? "outline" : "default"} data-testid="admin-deal-status">{DEAL_STATUS_LABEL[d.status]}</Badge>
        </div>
        {d.status !== "cancelled" && (
          <ol aria-label="진행 단계" className="mt-4 flex flex-wrap gap-1.5 text-micro">
            {DEAL_FLOW.map((s, i) => (
              <li key={s} aria-current={i === stepIndex ? "step" : undefined}
                className={cn("rounded-full px-2.5 py-1", i < stepIndex ? "bg-secondary text-secondary-foreground" : i === stepIndex ? "bg-primary text-primary-foreground" : "bg-section text-muted-foreground")}>
                {DEAL_STATUS_LABEL[s]}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <div className="space-y-6">
          {(actions.canStart || actions.canAdvance) && (
            <Tile className="p-5 md:p-7">
              <h2 className="text-eyebrow tracking-tight">다음 단계</h2>
              {actions.canStart ? (
                <DealProgressButton dealId={d.id} version={d.version} kind="start"
                  label="가격 협의 시작" description={d.side === "buy" ? "매물이 '상담 중'으로 잠기고 다른 상담은 협의를 시작할 수 없습니다." : "매도 상담 협의를 시작합니다."} />
              ) : next && (
                <DealProgressButton dealId={d.id} version={d.version} kind="advance" toStatus={next}
                  label={`${DEAL_STATUS_LABEL[next]}(으)로 진행`} blocker={blocker}
                  description={next === "completed" && d.side === "buy" ? "완료하면 매물이 판매완료로 바뀝니다. 되돌릴 수 없습니다." : "고객에게 단계 변경 알림이 갑니다."} />
              )}
            </Tile>
          )}
          {!actions.canAdvance && !actions.canStart && next && (
            <p className="rounded-tile bg-section px-5 py-4 text-small text-muted-foreground">
              단계 진행·조건 수정은 담당자 또는 최고관리자만 할 수 있습니다.
            </p>
          )}

          <Tile className="p-5 md:p-7">
            <h2 className="text-eyebrow tracking-tight">거래 조건</h2>
            <dl className="mt-3 divide-y divide-border/70 text-small">
              <Row label="골프장">{product?.golf_courses?.name ?? "-"} · {product?.kind ?? "-"}</Row>
              {d.membership_listings && (
                <Row label="매물">
                  호가 {formatWon(d.membership_listings.asking_price)} · {LISTING_STATUS_LABEL[d.membership_listings.status]}
                </Row>
              )}
              <Row label="희망가">{d.desired_price == null ? "-" : formatWon(d.desired_price)}</Row>
              <Row label="합의가"><span data-testid="agreed-price">{d.agreed_price == null ? "-" : formatWon(d.agreed_price)}</span></Row>
              <Row label="계약일">{d.contract_date ? formatKstDate(d.contract_date) : "-"}</Row>
              <Row label="연락 가능">{d.contact_window ?? "-"}</Row>
              <Row label="요청사항"><span className="whitespace-pre-wrap">{d.note ?? "-"}</span></Row>
              {d.close_reason && <Row label="취소 사유">{d.close_reason}</Row>}
            </dl>
            {actions.canEditTerms && (
              <div className="mt-5 border-t border-border/70 pt-5">
                <DealTermsForm dealId={d.id} version={d.version} agreedPrice={d.agreed_price} contractDate={d.contract_date} />
              </div>
            )}
          </Tile>

          <section aria-labelledby="notes-title" className="space-y-3">
            <h2 id="notes-title" className="text-eyebrow tracking-tight">통화 메모</h2>
            <ActivityNoteForm customerId={d.user_id} subjectType="deal" subjectId={d.id} />
            <ActivityNotes notes={notes ?? []} authors={authors} showSubject={false} />
          </section>

          {actions.canCancel && (
            <Tile className="p-5"><DealCancelForm dealId={d.id} version={d.version} holdsListing={d.side === "buy" && d.status !== "inquiry"} /></Tile>
          )}
        </div>

        <div className="space-y-6">
          <Tile className="p-5">
            <h2 className="text-eyebrow tracking-tight">고객</h2>
            <p className="mt-3 text-body font-semibold">{d.customer?.display_name ?? "-"}</p>
            <p className="text-body tabular-nums">
              {d.customer?.phone ? <a className="text-primary hover:underline" href={`tel:${d.customer.phone}`}>{formatPhone(d.customer.phone)}</a> : "-"}
            </p>
            <p className="text-micro text-muted-foreground">{d.customer?.phone_verified_at ? "인증된 번호" : "미인증(직접 입력)"}</p>
            <Link href={`/admin/customers/${d.user_id}`} className="pressable mt-3 inline-flex min-h-11 items-center text-small text-primary hover:underline">
              고객 정보·메모 ›
            </Link>
          </Tile>

          <Tile className="p-5">
            <h2 className="text-eyebrow tracking-tight">담당자</h2>
            <p className="mt-2 text-body" data-testid="deal-assignee">{d.assignee?.display_name ?? "미배정"}</p>
            {actions.canAssign && (
              <DealAssignForm dealId={d.id} version={d.version} currentAssigneeId={d.assignee_id} staff={staff ?? []} />
            )}
          </Tile>

          <Tile className="p-5">
            <h2 className="text-eyebrow tracking-tight">진행 상황</h2>
            <ol className="mt-3 space-y-3">
              {d.deal_events.map((e) => (
                <li key={e.id} className="text-small">
                  <p>{e.message ?? DEAL_STATUS_LABEL[e.to_status]}</p>
                  <p className="text-micro text-muted-foreground tabular-nums">{formatKst(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Tile>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

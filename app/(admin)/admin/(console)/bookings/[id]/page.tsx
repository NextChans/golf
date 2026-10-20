import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { formatKst, formatKstDate } from "@/lib/format/kst";
import { formatPhone } from "@/lib/domain/phone";
import { formatWon } from "@/lib/domain/booking/money";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT, describeTimePref } from "@/lib/domain/booking/status";
import { adminActions } from "@/lib/domain/booking/admin";
import { ActivityNoteForm } from "@/components/admin/activity-note-form";
import { ActivityNotes, fetchNoteAuthors } from "@/components/admin/activity-notes";
import { AssignForm } from "./assign-form";
import { CancelForm, ProposeForm, RejectForm } from "./decision-forms";

export const metadata: Metadata = { title: "요청 상세", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROPOSAL_STATUS_LABEL = { offered: "제안 중", accepted: "수락", declined: "거절", expired: "만료", withdrawn: "회수" } as const;

/** 라운딩 날짜(KST)가 주말이면 주말 그린피를 기본값으로 */
function defaultGreenFee(playDate: string, course: { weekday_green_fee: number | null; weekend_green_fee: number | null } | null) {
  if (!course) return null;
  const day = new Date(`${playDate}T12:00:00+09:00`).getUTCDay();
  return day === 0 || day === 6 ? course.weekend_green_fee : course.weekday_green_fee;
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // 요청·고객·담당자·제안·타임라인을 한 번에 조회하고, 배정 대상 목록만 따로 가져온다
  const [{ data: b, error }, { data: staff }, { data: notes }] = await Promise.all([
    supabase
      .from("booking_requests")
      .select(`id, user_id, status, version, play_date, time_pref, time_from, time_to, players, budget_per_person, note,
        course_name_free, close_reason, created_at, sla_due_at, sla_breached_at, first_responded_at, assignee_id,
        golf_courses(name, weekday_green_fee, weekend_green_fee, cancellation_policy, contact_phone),
        customer:profiles!booking_requests_user_id_fkey(id, display_name, phone, phone_verified_at),
        assignee:profiles!booking_requests_assignee_id_fkey(display_name),
        booking_proposals(id, status, tee_time, green_fee_per_person, memo, expires_at, created_at),
        booking_events(id, to_status, message, created_at)`)
      .eq("id", id)
      .order("created_at", { referencedTable: "booking_proposals", ascending: false })
      .order("id", { referencedTable: "booking_events", ascending: true })
      .maybeSingle(),
    supabase.rpc("list_assignable_staff"),
    supabase
      .from("activity_notes")
      .select("id, subject_type, subject_id, body, author_id, created_at")
      .eq("subject_type", "booking")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error("admin booking detail query failed");
  if (!b) notFound();

  const authors = await fetchNoteAuthors(supabase, notes ?? []);
  const isAssignee = b.assignee_id === session.userId;
  const actions = adminActions(b.status, { isAssignee, isOwner: session.role === "owner" });
  const course = b.golf_courses;
  const courseName = course?.name ?? b.course_name_free ?? "골프장 미정";
  const breached = b.status === "requested" && Date.parse(b.sla_due_at) < Date.now();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/bookings" className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4">
          <span aria-hidden className="text-[1.1em] leading-none">‹</span>요청 인박스
        </Link>
        <p className="mt-2 text-small text-muted-foreground">
          {formatKstDate(b.play_date)} · {describeTimePref(b.time_pref, b.time_from, b.time_to)} · {b.players}명
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-title tracking-tight">{courseName}</h1>
          <Badge variant={BOOKING_STATUS_VARIANT[b.status]} data-testid="admin-booking-status">{BOOKING_STATUS_LABEL[b.status]}</Badge>
          {breached && <Badge variant="destructive">SLA 초과</Badge>}
        </div>
        <p className="mt-2 text-micro text-muted-foreground tabular-nums">
          접수 {formatKst(b.created_at)} · 응답 기한 {formatKst(b.sla_due_at)}
          {b.first_responded_at && ` · 첫 응답 ${formatKst(b.first_responded_at)}`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <div className="space-y-6">
          {actions.canPropose && (
            <section aria-labelledby="propose-title" className="space-y-3">
              <h2 id="propose-title" className="text-eyebrow tracking-tight">티타임 제안</h2>
              <Tile className="p-5 md:p-7">
                <ProposeForm
                  requestId={b.id}
                  version={b.version}
                  defaultGreenFee={defaultGreenFee(b.play_date, course)}
                  playDate={b.play_date}
                  hasOffered={b.booking_proposals.some((p) => p.status === "offered")}
                />
              </Tile>
            </section>
          )}
          {!actions.canPropose && (b.status === "in_review" || b.status === "proposed") && (
            <p className="rounded-tile bg-section px-5 py-4 text-small text-muted-foreground">
              제안은 담당자 또는 최고관리자만 할 수 있습니다. 먼저 담당자를 본인으로 배정해 주세요.
            </p>
          )}

          <Tile className="p-5 md:p-7">
            <h2 className="text-eyebrow tracking-tight">요청 내용</h2>
            <dl className="mt-3 divide-y divide-border/70 text-small">
              <Row label="예산">{b.budget_per_person == null ? "-" : `1인 ${formatWon(b.budget_per_person)}`}</Row>
              <Row label="요청사항"><span className="whitespace-pre-wrap">{b.note ?? "-"}</span></Row>
              {course && <Row label="그린피 기준">주중 {fmt(course.weekday_green_fee)} · 주말 {fmt(course.weekend_green_fee)}</Row>}
              {course?.contact_phone && <Row label="골프장 연락처">{course.contact_phone}</Row>}
              {course?.cancellation_policy && <Row label="취소 규정"><span className="whitespace-pre-wrap">{course.cancellation_policy}</span></Row>}
              {b.close_reason && <Row label="종료 사유">{b.close_reason}</Row>}
            </dl>
          </Tile>

          <section aria-labelledby="proposals-title" className="space-y-3">
            <h2 id="proposals-title" className="text-eyebrow tracking-tight">제안 이력</h2>
            {b.booking_proposals.length === 0 ? (
              <p className="text-small text-muted-foreground">아직 제안하지 않았습니다.</p>
            ) : (
              <ul className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card text-small">
                {b.booking_proposals.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums">{formatKst(p.tee_time)} · 1인 {formatWon(p.green_fee_per_person)}</p>
                      <p className="text-micro text-muted-foreground tabular-nums">
                        제안 {formatKst(p.created_at)} · 유효 {formatKst(p.expires_at)}
                      </p>
                      {p.memo && <p className="mt-1 text-micro whitespace-pre-wrap">{p.memo}</p>}
                    </div>
                    <Badge variant={p.status === "offered" || p.status === "accepted" ? "default" : "outline"}>
                      {PROPOSAL_STATUS_LABEL[p.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="notes-title" className="space-y-3">
            <h2 id="notes-title" className="text-eyebrow tracking-tight">통화 메모</h2>
            <ActivityNoteForm customerId={b.user_id} subjectType="booking" subjectId={b.id} />
            <ActivityNotes notes={notes ?? []} authors={authors} showSubject={false} />
          </section>

          {(actions.canReject || actions.canCancel) && (
            <section aria-labelledby="close-title" className="space-y-3">
              <h2 id="close-title" className="text-eyebrow tracking-tight">종료 처리</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {actions.canReject && <Tile className="p-5"><RejectForm requestId={b.id} version={b.version} /></Tile>}
                {actions.canCancel && (
                  <Tile className="p-5"><CancelForm requestId={b.id} version={b.version} confirmed={b.status === "confirmed"} /></Tile>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <Tile className="p-5">
            <h2 className="text-eyebrow tracking-tight">고객</h2>
            <p className="mt-3 text-body font-semibold">{b.customer?.display_name ?? "-"}</p>
            {/* 상세 화면은 전화 확인을 위해 전체 번호를 보여준다(목록은 마스킹) */}
            <p className="text-body tabular-nums">
              {b.customer?.phone ? <a className="text-primary hover:underline" href={`tel:${b.customer.phone}`}>{formatPhone(b.customer.phone)}</a> : "-"}
            </p>
            <p className="text-micro text-muted-foreground">{b.customer?.phone_verified_at ? "인증된 번호" : "미인증(직접 입력)"}</p>
            <Link href={`/admin/customers/${b.user_id}`} className="pressable mt-3 inline-flex min-h-11 items-center text-small text-primary hover:underline">
              고객 정보·메모 ›
            </Link>
          </Tile>

          <Tile className="p-5">
            <h2 className="text-eyebrow tracking-tight">담당자</h2>
            <p className="mt-2 text-body" data-testid="assignee-name">{b.assignee?.display_name ?? "미배정"}</p>
            {actions.canAssign && (
              <AssignForm requestId={b.id} version={b.version} currentAssigneeId={b.assignee_id} staff={staff ?? []} />
            )}
          </Tile>

          <Tile className="p-5">
            <h2 className="text-eyebrow tracking-tight">진행 상황</h2>
            <ol className="mt-3 space-y-3">
              {b.booking_events.map((e) => (
                <li key={e.id} className="text-small">
                  <p>{e.message ?? BOOKING_STATUS_LABEL[e.to_status]}</p>
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

const fmt = (v: number | null) => (v == null ? "-" : formatWon(v));

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

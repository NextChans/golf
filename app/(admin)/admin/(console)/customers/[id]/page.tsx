import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { MoreLink, Tile } from "@/components/site/section";
import { ActivityNoteForm } from "@/components/admin/activity-note-form";
import { ActivityNotes, fetchNoteAuthors } from "@/components/admin/activity-notes";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/domain/phone";
import { logPiiView } from "@/lib/admin/pii";
import { DEAL_SIDE_LABEL, DEAL_STATUS_LABEL } from "@/lib/domain/membership/status";
import { formatKst } from "@/lib/format/kst";

export const metadata: Metadata = { title: "고객 상세", robots: { index: false } };

const ListError = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{children}</p>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-tile bg-section px-5 py-4 text-body text-muted-foreground">{children}</p>
);

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: customer, error: customerError } = await supabase
    .from("profiles")
    .select("id, display_name, phone, phone_verified_at, onboarded_at, deleted_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (customerError) throw customerError;
  // 운영자 profiles(onboarded_at null)는 고객이 아니다
  if (!customer || !customer.onboarded_at) notFound();

  const [deals, notes] = await Promise.all([
    supabase
      .from("membership_deals")
      .select("id, side, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("activity_notes")
      .select("id, subject_type, subject_id, body, author_id, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
  ]);
  // 상세 화면은 고객 전체 번호를 보여 주므로 열람을 기록한다(D-75)
  const [authors] = await Promise.all([
    notes.data ? fetchNoteAuthors(supabase, notes.data) : Promise.resolve({} as Record<string, string>),
    logPiiView(supabase, "customer", id),
  ]);

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <MoreLink href="/admin/customers" className="text-small">고객 목록</MoreLink>
        <h1 className="flex flex-wrap items-center gap-2 text-title tracking-tight">
          {customer.display_name ?? "(이름 없음)"}
          {customer.deleted_at && <Badge variant="outline">탈퇴</Badge>}
        </h1>
      </div>

      <Tile className="p-5 md:p-7">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-body">
          <dt className="text-muted-foreground">휴대폰</dt>
          <dd className="flex flex-wrap items-center gap-2 tabular-nums">
            {customer.phone ? <a href={`tel:${customer.phone}`} className="text-primary hover:underline">{formatPhone(customer.phone)}</a> : "-"}
            {customer.phone && (
              <Badge variant={customer.phone_verified_at ? "secondary" : "outline"}>
                {customer.phone_verified_at ? "인증됨" : "미인증(직접 입력)"}
              </Badge>
            )}
          </dd>
          <dt className="text-muted-foreground">가입일</dt>
          <dd>{formatKst(customer.created_at)}</dd>
          {customer.deleted_at && (
            <>
              <dt className="text-muted-foreground">탈퇴일</dt>
              <dd>{formatKst(customer.deleted_at)}</dd>
            </>
          )}
        </dl>
      </Tile>

      <section aria-labelledby="customer-notes-title" className="space-y-4">
        <h2 id="customer-notes-title" className="text-eyebrow tracking-tight">통화 메모</h2>
        <Tile className="p-5 md:p-7"><ActivityNoteForm customerId={customer.id} subjectType="customer" /></Tile>
        {notes.error ? <ListError>메모를 불러오지 못했습니다.</ListError> : <ActivityNotes notes={notes.data} authors={authors} />}
      </section>

      <section aria-labelledby="customer-deals-title" className="space-y-4">
        <h2 id="customer-deals-title" className="text-eyebrow tracking-tight">회원권 상담</h2>
        {deals.error ? (
          <ListError>회원권 상담을 불러오지 못했습니다.</ListError>
        ) : !deals.data.length ? (
          <Empty>회원권 상담이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
            {deals.data.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <p className="text-body">
                  {DEAL_SIDE_LABEL[d.side]} <span className="text-small text-muted-foreground">· 접수 {formatKst(d.created_at)}</span>
                </p>
                <Badge variant={d.status === "cancelled" ? "outline" : "secondary"}>{DEAL_STATUS_LABEL[d.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

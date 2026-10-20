import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MoreLink, Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/domain/booking/money";
import { formatKst } from "@/lib/format/kst";
import { LISTING_STATUS_ADMIN_LABEL } from "@/lib/domain/membership/admin-schema";
import { DEAL_SIDE_LABEL, DEAL_STATUS_LABEL } from "@/lib/domain/membership/status";
import { loadProductOptions } from "../../options";
import { ListingForm } from "../../listing-form";
import { VisibilityButton } from "../../visibility-button";

export const metadata: Metadata = { title: "매물 수정", robots: { index: false } };

const STATUS_HELP = {
  hidden: "고객 화면에 보이지 않습니다. 공개하면 매물 목록에 나타납니다.",
  listed: "고객 화면에 공개 중입니다.",
  reserved: "상담이 진행 중입니다. 상담이 끝나거나 취소될 때까지 공개 여부를 바꿀 수 없습니다.",
  sold: "거래가 완료된 매물입니다.",
} as const;

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [listingRes, dealsRes, products] = await Promise.all([
    supabase
      .from("membership_listings")
      .select("id, product_id, asking_price, description, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("membership_deals")
      .select("id, side, status, desired_price, agreed_price, created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    loadProductOptions(supabase),
  ]);
  if (listingRes.error) throw new Error("membership_listing_load_failed");
  const listing = listingRes.data;
  if (!listing) notFound();
  const deals = dealsRes.data ?? [];
  const productLabel = products.find((p) => p.id === listing.product_id)?.label ?? "매물";

  return (
    <div className="mx-auto max-w-[560px] space-y-8">
      <MoreLink href="/admin/memberships" className="text-small">매물 목록</MoreLink>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="text-title tracking-tight">매물 수정</h1>
          <Badge data-testid="listing-status" variant={listing.status === "listed" ? "default" : listing.status === "reserved" ? "outline" : "secondary"}>
            {LISTING_STATUS_ADMIN_LABEL[listing.status]}
          </Badge>
        </div>
        <p className="text-small text-muted-foreground">{productLabel}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-section px-5 py-4">
          <p className="text-small text-muted-foreground">{STATUS_HELP[listing.status]}</p>
          <VisibilityButton listingId={listing.id} status={listing.status} />
        </div>
        <p className="text-micro text-muted-foreground">등록 {formatKst(listing.created_at)} · 최근 수정 {formatKst(listing.updated_at)}</p>
      </div>

      <Tile className="p-5 md:p-7">
        {/* 상태가 바뀌면(상담 시작 등) 잠금 여부가 달라지므로 다시 그린다. updated_at은 key에 넣지 않는다(저장 직후 리렌더로 폼이 다시 마운트되면 이동 처리가 사라진다) */}
        <ListingForm key={listing.status} listing={listing} products={products} />
      </Tile>

      <section aria-labelledby="deals-heading" className="space-y-4">
        <h2 id="deals-heading" className="text-eyebrow font-semibold tracking-tight">이 매물의 상담</h2>
        {dealsRes.error ? (
          <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">상담 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>
        ) : deals.length === 0 ? (
          <p className="px-1 text-small text-muted-foreground">아직 접수된 상담이 없습니다.</p>
        ) : (
          <ul aria-label="상담 목록" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
            {deals.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/deals/${d.id}`} className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-section/60">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-body font-semibold">{DEAL_SIDE_LABEL[d.side]} 상담</p>
                      <Badge variant={d.status === "cancelled" || d.status === "completed" ? "secondary" : "default"}>
                        {DEAL_STATUS_LABEL[d.status]}
                      </Badge>
                    </div>
                    <p className="text-micro text-muted-foreground tabular-nums">
                      접수 {formatKst(d.created_at)}
                      {d.agreed_price != null ? <> · 합의가 {formatWon(d.agreed_price)}</> : d.desired_price != null ? <> · 희망가 {formatWon(d.desired_price)}</> : null}
                    </p>
                  </div>
                  <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

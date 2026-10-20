import type { Metadata } from "next";
import Link from "next/link";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/domain/booking/money";
import { formatKstDate } from "@/lib/format/kst";
import { LISTING_STATUS_ADMIN_LABEL, type ListingStatus } from "@/lib/domain/membership/admin-schema";
import { cn } from "@/lib/utils";
import { VisibilityButton } from "./visibility-button";

export const metadata: Metadata = { title: "매물·시세 관리", robots: { index: false } };

// 이 화면에는 loading.tsx·<Suspense>를 두지 않는다(D-62).
// 이미 보이는 Suspense 경계 안을 같은 화면에서 다시 그리는 전환(공개 전환 후 갱신, 탭 이동, 저장 후 목록 이동)이
// Next 15.5.28(React 19.2 canary) 운영 빌드에서 커밋되지 않고 멈춘다. 로딩 표시는 버튼·폼의 pending 상태가 맡는다.

const TABS = ["listings", "products"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { listings: "매물", products: "상품·시세" };
const parseTab = (v: string | string[] | undefined): Tab => (v === "products" ? "products" : "listings");

const STATUS_VARIANT: Record<ListingStatus, "default" | "secondary" | "outline"> = {
  listed: "default", reserved: "outline", hidden: "secondary", sold: "secondary",
};
const LIMIT = 200;

type ListingRow = {
  id: string; asking_price: number; status: ListingStatus; updated_at: string;
  product: { kind: string; name: string; golf_course: { name: string } | null } | null;
};
type ProductRow = {
  id: string; kind: string; name: string; is_active: boolean;
  golf_course: { name: string } | null;
  quotes: { quoted_on: string; buy_price: number | null; sell_price: number | null }[];
};

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  // 권한은 (console) 레이아웃의 requireStaff가 검사한다. RLS상 운영자는 비공개·판매 중지 항목도 본다.
  const tab = parseTab((await searchParams).tab);
  const supabase = await createClient();

  // 탭마다 임베드 select 한 번(N+1 없음). 상품 탭의 최신 시세는 하위 테이블 order+limit 1로 함께 가져온다
  const result = tab === "listings"
    ? await supabase
        .from("membership_listings")
        .select("id, asking_price, status, updated_at, product:membership_products(kind, name, golf_course:golf_courses(name))")
        .order("updated_at", { ascending: false })
        .limit(LIMIT)
    : await supabase
        .from("membership_products")
        .select("id, kind, name, is_active, golf_course:golf_courses(name), quotes:membership_quotes(quoted_on, buy_price, sell_price)")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })
        .order("quoted_on", { referencedTable: "membership_quotes", ascending: false })
        .limit(1, { referencedTable: "membership_quotes" })
        .limit(LIMIT);
  const rows = result.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title tracking-tight">매물·시세 관리</h1>
          <p className="mt-2 text-body text-muted-foreground">회원권 상품과 시세, 고객에게 보여 줄 매물을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/memberships/products/new">상품 추가</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/memberships/listings/new">매물 등록</Link>
          </Button>
        </div>
      </div>

      <nav aria-label="매물·상품 탭" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t}>
              <Link
                href={`/admin/memberships?tab=${t}`}
                aria-current={t === tab ? "page" : undefined}
                className={cn(
                  "pressable inline-flex h-9 items-center rounded-full px-4 text-small whitespace-nowrap",
                  t === tab ? "bg-foreground text-background" : "bg-section text-foreground hover:bg-border/60",
                )}
              >
                {TAB_LABEL[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {result.error ? (
        <Tile className="p-6 md:p-8">
          <p role="alert" className="text-body text-destructive">목록을 불러오지 못했습니다.</p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href={`/admin/memberships?tab=${tab}`}>다시 시도</Link>
          </Button>
        </Tile>
      ) : rows.length === 0 ? (
        <Tile className="p-6 text-center md:p-10">
          <p className="text-eyebrow tracking-tight">{tab === "listings" ? "등록된 매물이 없습니다" : "등록된 상품이 없습니다"}</p>
          <p className="mt-2 text-small text-muted-foreground">
            {tab === "listings" ? "상품을 먼저 추가한 뒤 매물을 등록하세요. 새 매물은 비공개로 시작합니다." : "골프장별 회원권 종류를 상품으로 추가하면 시세와 매물을 등록할 수 있습니다."}
          </p>
          <Button asChild className="mt-6">
            <Link href={tab === "listings" ? "/admin/memberships/listings/new" : "/admin/memberships/products/new"}>
              {tab === "listings" ? "매물 등록" : "상품 추가"}
            </Link>
          </Button>
        </Tile>
      ) : tab === "listings" ? (
        <ListingList rows={rows as unknown as ListingRow[]} />
      ) : (
        <ProductList rows={rows as unknown as ProductRow[]} />
      )}
    </div>
  );
}

function ListingList({ rows }: { rows: ListingRow[] }) {
  return (
    <ul aria-label="매물 목록" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
      {rows.map((l) => {
        const title = `${l.product?.golf_course?.name ?? "골프장"} ${l.product?.kind ?? ""}`.trim();
        return (
          <li key={l.id} className="flex items-center gap-3 pr-4 hover:bg-section/60">
            <Link href={`/admin/memberships/listings/${l.id}`} className="pressable flex min-w-0 flex-1 items-center justify-between gap-3 py-4 pl-5">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-body font-semibold">{title}</p>
                  <Badge variant={STATUS_VARIANT[l.status]}>{LISTING_STATUS_ADMIN_LABEL[l.status]}</Badge>
                </div>
                <p className="text-small text-muted-foreground">
                  <span className="tabular-nums">호가 {formatWon(l.asking_price)}</span>
                  {l.product?.name && <><span aria-hidden> · </span>{l.product.name}</>}
                </p>
              </div>
              <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
            </Link>
            <VisibilityButton listingId={l.id} status={l.status} label={title} />
          </li>
        );
      })}
    </ul>
  );
}

function ProductList({ rows }: { rows: ProductRow[] }) {
  return (
    <ul aria-label="상품 목록" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
      {rows.map((p) => {
        const q = p.quotes[0];
        return (
          <li key={p.id}>
            <Link href={`/admin/memberships/products/${p.id}`} className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-section/60">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-body font-semibold">{p.golf_course?.name ?? "골프장"} {p.kind}</p>
                  <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "판매 중" : "판매 중지"}</Badge>
                </div>
                <p className="truncate text-small text-muted-foreground">{p.name}</p>
                <p className="text-micro text-muted-foreground tabular-nums">
                  {q ? (
                    <>
                      시세 {formatKstDate(q.quoted_on)}
                      <span aria-hidden> · </span>매수 {formatWon(q.buy_price)}
                      <span aria-hidden> · </span>매도 {formatWon(q.sell_price)}
                    </>
                  ) : "시세 미입력"}
                </p>
              </div>
              <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

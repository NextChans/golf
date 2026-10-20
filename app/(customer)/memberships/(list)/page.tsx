import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatKstDate } from "@/lib/format/kst";
import { formatWon } from "@/lib/domain/booking/money";
import { REGION_LABEL, REGIONS } from "@/lib/domain/course/schema";
import {
  formatKoreanPrice, LISTING_SORT_LABEL, LISTING_SORTS, parseListingFilters,
} from "@/lib/domain/membership/schema";
import { LISTING_STATUS_LABEL, PUBLIC_LISTING_STATUSES } from "@/lib/domain/membership/status";
import { Chevron, fieldLabelClass, selectClass } from "../fields";

export const metadata: Metadata = { title: "회원권 매물" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const inputClass =
  "h-14 w-full rounded-xl border border-input bg-card px-4 pt-5 pb-1.5 text-body outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

export default async function MembershipsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseListingFilters(await searchParams);
  const supabase = await createClient();

  // 매물·상품·골프장·최신 시세를 한 번에 조회(N+1 없음). 공개 정책(D-16): hidden 제외, 비활성 상품·골프장은 RLS로 빠진다.
  // 지역 필터는 골프장 inner join 조건, 가격 필터는 원 단위(입력은 만원).
  let query = supabase
    .from("membership_listings")
    .select(`id, status, asking_price, created_at,
      membership_products!inner(id, kind, name, golf_courses!inner(name, region),
        membership_quotes(quoted_on, buy_price, sell_price))`)
    .in("status", [...PUBLIC_LISTING_STATUSES])
    .order("quoted_on", { referencedTable: "membership_products.membership_quotes", ascending: false })
    .limit(1, { referencedTable: "membership_products.membership_quotes" });
  if (filters.region) query = query.eq("membership_products.golf_courses.region", filters.region);
  if (filters.minWon !== null) query = query.gte("asking_price", filters.minWon);
  if (filters.maxWon !== null) query = query.lte("asking_price", filters.maxWon);
  query =
    filters.sort === "newest"
      ? query.order("created_at", { ascending: false })
      : query.order("asking_price", { ascending: filters.sort === "price_asc" }).order("created_at", { ascending: false });
  const { data: listings, error } = await query.limit(60);

  const filtered = filters.region !== null || filters.minWon !== null || filters.maxWon !== null;

  return (
    <>
      <GlobalNav />
      <LocalNav
        title="회원권"
        action={<Button asChild size="sm"><Link href="/memberships/sell">매도 상담</Link></Button>}
      />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-12 pb-8 md:pt-20 md:pb-12">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">회원권 매물</h1>
          <p className="mt-3 max-w-[560px] text-eyebrow text-muted-foreground">
            시세와 호가를 확인하고 온라인으로 상담을 신청하세요. 계약은 담당자와 안전하게 진행합니다.
          </p>
        </div>

        {/* 검색 조건: GET 폼(JS 없이도 동작, URL 공유 가능). 가격은 만원 단위 */}
        <div className="mx-auto max-w-[1024px] px-4 pb-8 md:pb-12">
          <form method="get" action="/memberships" className="grid grid-cols-2 gap-2.5 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] md:items-center" aria-label="매물 검색">
            <div className="relative col-span-2 md:col-span-1">
              <select id="region" name="region" defaultValue={filters.region ?? ""} className={selectClass}>
                <option value="">전체 지역</option>
                {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
              </select>
              <label htmlFor="region" className={fieldLabelClass}>지역</label>
              <Chevron />
            </div>
            <div className="relative">
              <input
                id="min" name="min" inputMode="numeric" pattern="[0-9,]*" defaultValue={filters.minManWon ?? ""}
                placeholder="예: 10000" className={`${inputClass} pr-14 placeholder:text-muted-foreground/60`}
              />
              <label htmlFor="min" className={fieldLabelClass}>최소 호가(만원)</label>
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-small text-muted-foreground">만원</span>
            </div>
            <div className="relative">
              <input
                id="max" name="max" inputMode="numeric" pattern="[0-9,]*" defaultValue={filters.maxManWon ?? ""}
                placeholder="예: 50000" className={`${inputClass} pr-14 placeholder:text-muted-foreground/60`}
              />
              <label htmlFor="max" className={fieldLabelClass}>최대 호가(만원)</label>
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-small text-muted-foreground">만원</span>
            </div>
            <div className="relative col-span-2 md:col-span-1">
              <select id="sort" name="sort" defaultValue={filters.sort} className={selectClass}>
                {LISTING_SORTS.map((s) => <option key={s} value={s}>{LISTING_SORT_LABEL[s]}</option>)}
              </select>
              <label htmlFor="sort" className={fieldLabelClass}>정렬</label>
              <Chevron />
            </div>
            <div className="col-span-2 flex items-center justify-center gap-4 md:col-span-1">
              <Button type="submit" className="w-full md:w-auto">검색</Button>
              {filtered && (
                <Link href="/memberships" className="pressable shrink-0 text-small text-primary hover:underline underline-offset-4">초기화</Link>
              )}
            </div>
          </form>
        </div>

        <section className="bg-section py-10 md:py-16" aria-label="매물 목록">
          <div className="mx-auto max-w-[1024px] px-4">
            {error ? (
              <Tile className="bg-card text-center">
                <p role="alert" className="text-eyebrow text-destructive">
                  매물 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
                <Button asChild variant="secondary" className="mt-6"><Link href="/memberships">다시 시도</Link></Button>
              </Tile>
            ) : !listings?.length ? (
              <Tile className="bg-card px-6 py-14 text-center md:py-20">
                <h2 className="text-eyebrow font-semibold tracking-tight md:text-title">
                  {filtered ? "조건에 맞는 매물이 없습니다" : "지금 공개된 매물이 없습니다"}
                </h2>
                <p className="mx-auto mt-3 max-w-[420px] text-body text-muted-foreground">
                  {filtered ? "지역이나 가격 범위를 넓혀 다시 찾아보세요." : "새 매물이 등록되면 이곳에 표시됩니다. 보유 회원권 매도 상담은 바로 신청할 수 있습니다."}
                </p>
                <Button asChild className="mt-8">
                  {filtered ? <Link href="/memberships">전체 매물 보기</Link> : <Link href="/memberships/sell">매도 상담 신청</Link>}
                </Button>
              </Tile>
            ) : (
              <>
                <p className="mb-4 text-small text-muted-foreground">매물 {listings.length}건</p>
                <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
                  {listings.map((l) => {
                    const p = l.membership_products;
                    const quote = p.membership_quotes[0] ?? null;
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/memberships/${l.id}`}
                          className="pressable group flex min-h-[132px] items-center gap-4 rounded-tile bg-card p-5 outline-none hover:bg-card/70 focus-visible:ring-4 focus-visible:ring-ring/40 md:p-6"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-eyebrow font-semibold tracking-tight">{p.golf_courses.name}</p>
                                <p className="mt-0.5 text-small text-muted-foreground">
                                  {REGION_LABEL[p.golf_courses.region]} · {p.kind}
                                </p>
                              </div>
                              {l.status === "reserved" && (
                                <Badge variant="secondary" className="mt-0.5 px-2.5 py-1 text-micro">{LISTING_STATUS_LABEL.reserved}</Badge>
                              )}
                            </div>
                            <p className="mt-3 text-eyebrow font-semibold tabular-nums">{formatWon(l.asking_price)}</p>
                            <p className="text-micro text-muted-foreground">호가 {formatKoreanPrice(l.asking_price)}</p>
                            <p className="mt-2 text-micro text-muted-foreground tabular-nums">
                              {quote
                                ? `시세(${formatKstDate(quote.quoted_on)}) 매수 ${formatKoreanPrice(quote.buy_price)} · 매도 ${formatKoreanPrice(quote.sell_price)}`
                                : "시세 정보 없음"}
                            </p>
                          </div>
                          <span aria-hidden className="text-eyebrow text-muted-foreground transition group-hover:translate-x-0.5">›</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

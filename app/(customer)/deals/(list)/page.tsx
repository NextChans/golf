import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { formatKstDate } from "@/lib/format/kst";
import { todayKst } from "@/lib/domain/booking/schema";
import { formatKoreanPrice } from "@/lib/domain/membership/schema";
import { DEAL_SIDE_LABEL, DEAL_STATUS_LABEL, DEAL_STATUS_VARIANT } from "@/lib/domain/membership/status";

export const metadata: Metadata = { title: "내 거래" };

export default async function DealsPage() {
  await requireCustomer();
  const supabase = await createClient();
  // 목록 1회 조회(상품·골프장은 FK embedding). RLS가 본인 행만 돌려준다.
  const { data: deals, error } = await supabase
    .from("membership_deals")
    .select("id, side, status, desired_price, agreed_price, created_at, membership_products(name, kind, golf_courses(name))")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <GlobalNav />
      <LocalNav
        title="내 거래"
        action={<Button asChild size="sm"><Link href="/memberships">매물 보기</Link></Button>}
      />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-12 pb-10 md:pt-20 md:pb-14">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">내 거래</h1>
          <p className="mt-3 max-w-[560px] text-eyebrow text-muted-foreground">
            회원권 매수·매도 상담의 진행 단계를 한곳에서 확인하세요.
          </p>
        </div>

        <section className="bg-section py-10 md:py-16" aria-label="거래 목록">
          <div className="mx-auto max-w-[1024px] px-4">
            {error ? (
              <Tile className="bg-card text-center">
                <p role="alert" className="text-eyebrow text-destructive">
                  거래 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
                <Button asChild variant="secondary" className="mt-6"><Link href="/deals">다시 시도</Link></Button>
              </Tile>
            ) : !deals?.length ? (
              <Tile className="bg-card px-6 py-14 text-center md:py-20">
                <h2 className="text-eyebrow font-semibold tracking-tight md:text-title">아직 상담 내역이 없습니다</h2>
                <p className="mx-auto mt-3 max-w-[420px] text-body text-muted-foreground">
                  공개 매물을 둘러보고 매수 상담을 신청하거나, 보유 회원권 매도 상담을 시작해 보세요.
                </p>
                <Button asChild className="mt-8"><Link href="/memberships">회원권 매물 보기</Link></Button>
              </Tile>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
                {deals.map((d) => {
                  const p = d.membership_products;
                  const price = d.agreed_price ?? d.desired_price;
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/deals/${d.id}`}
                        className="pressable group flex min-h-[104px] items-center gap-4 rounded-tile bg-card p-5 outline-none hover:bg-card/70 focus-visible:ring-4 focus-visible:ring-ring/40 md:p-6"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-eyebrow font-semibold tracking-tight">
                              <span className="mr-1.5 text-primary">{DEAL_SIDE_LABEL[d.side]}</span>
                              {p?.name ?? "회원권"}
                            </p>
                            <Badge variant={DEAL_STATUS_VARIANT[d.status]} className="mt-0.5 px-2.5 py-1 text-micro">
                              {DEAL_STATUS_LABEL[d.status]}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-small text-muted-foreground tabular-nums">
                            {formatKstDate(todayKst(new Date(d.created_at)))} 신청
                            {price != null && ` · ${d.agreed_price != null ? "합의가" : "희망가"} ${formatKoreanPrice(price)}`}
                          </p>
                        </div>
                        <span aria-hidden className="text-eyebrow text-muted-foreground transition group-hover:translate-x-0.5">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import { formatKstDate } from "@/lib/format/kst";
import { formatWon } from "@/lib/domain/booking/money";
import { REGION_LABEL } from "@/lib/domain/course/schema";
import { formatKoreanPrice } from "@/lib/domain/membership/schema";
import { DEAL_STATUS_LABEL, LISTING_STATUS_LABEL, PUBLIC_LISTING_STATUSES } from "@/lib/domain/membership/status";
import { InquiryForm } from "./inquiry-form";

export const metadata: Metadata = { title: "회원권 매물" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUOTE_ROWS = 12;

export default async function MembershipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const session = await getSession();
  const isCustomer = session?.role === "customer";
  const supabase = await createClient();

  // 매물·상품·골프장·시세(최근 12건)를 한 번에. 고객이면 연락처·온보딩과 이 매물의 진행 중 상담을 함께 조회한다.
  const [{ data: l, error }, profileRes, openDealRes] = await Promise.all([
    supabase
      .from("membership_listings")
      .select(`id, status, asking_price, description, created_at,
        membership_products!inner(id, kind, name, golf_courses!inner(name, region, address),
          membership_quotes(id, quoted_on, buy_price, sell_price))`)
      .eq("id", id)
      .in("status", [...PUBLIC_LISTING_STATUSES])
      .order("quoted_on", { referencedTable: "membership_products.membership_quotes", ascending: false })
      .limit(QUOTE_ROWS, { referencedTable: "membership_products.membership_quotes" })
      .maybeSingle(),
    isCustomer
      ? supabase.from("profiles").select("phone, onboarded_at").eq("id", session.userId).maybeSingle()
      : Promise.resolve(null),
    isCustomer
      ? supabase
          .from("membership_deals")
          .select("id, status")
          .eq("listing_id", id)
          .not("status", "in", "(completed,cancelled)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  if (error) throw new Error("membership detail query failed");
  // 없음·비공개(hidden, RLS로 0행)·판매 완료는 같은 화면(존재 여부 비노출)
  if (!l) notFound();

  const p = l.membership_products;
  const course = p.golf_courses;
  const quotes = p.membership_quotes;
  const latest = quotes[0] ?? null;
  const profile = profileRes?.data ?? null;
  const openDeal = openDealRes?.data ?? null;
  const loginHref = `/login?next=${encodeURIComponent(`/memberships/${l.id}`)}`;

  let cta: React.ReactNode;
  if (l.status === "reserved") {
    cta = (
      <p className="text-body text-muted-foreground">
        다른 고객과 상담이 진행 중인 매물입니다. 비슷한 조건의 매물은 담당자에게 문의해 주세요.
      </p>
    );
  } else if (!session) {
    cta = (
      <div className="space-y-4 text-center">
        <p className="text-body text-muted-foreground">상담 신청은 로그인 후 이용할 수 있습니다.</p>
        <Button asChild><Link href={loginHref as never}>로그인하고 상담 신청</Link></Button>
      </div>
    );
  } else if (!isCustomer) {
    cta = <p className="text-body text-muted-foreground">운영자 계정으로는 상담을 신청할 수 없습니다.</p>;
  } else if (!profile?.onboarded_at) {
    cta = (
      <div className="space-y-4 text-center">
        <p className="text-body text-muted-foreground">이름 입력과 약관 동의를 먼저 완료해 주세요.</p>
        <Button asChild>
          <Link href={`/onboarding?next=${encodeURIComponent(`/memberships/${l.id}`)}` as never}>가입 마무리하기</Link>
        </Button>
      </div>
    );
  } else if (openDeal) {
    cta = (
      <div className="space-y-4 text-center">
        <p className="text-body">이 매물로 진행 중인 상담이 있습니다({DEAL_STATUS_LABEL[openDeal.status]}).</p>
        <Button asChild><Link href={`/deals/${openDeal.id}`}>내 상담 보기</Link></Button>
      </div>
    );
  } else if (!profile.phone) {
    // 연락처가 없으면 상담을 받을 수 없다(D-48, DB 트리거가 최종 차단)
    cta = (
      <div className="text-center" data-testid="contact-required">
        <p className="text-eyebrow font-semibold">연락처를 먼저 입력해 주세요</p>
        <p className="mt-2 text-body text-muted-foreground">담당자가 상담 전화를 드려야 해서 휴대폰 번호가 필요합니다.</p>
        <Button asChild className="mt-6"><Link href="/me#contact">연락처 입력하기</Link></Button>
      </div>
    );
  } else {
    // 멱등키는 렌더마다 새로 발급. 같은 폼의 중복 제출은 같은 키로 들어와 1건만 생성된다(D-10).
    cta = <InquiryForm idempotencyKey={randomUUID()} listingId={l.id} />;
  }

  return (
    <>
      <GlobalNav />
      <LocalNav title={course.name} />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-8 pb-10 md:pt-12 md:pb-14">
          <Link
            href="/memberships"
            className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4"
          >
            <span aria-hidden className="text-[1.1em] leading-none">‹</span>회원권 매물
          </Link>
          <p className="mt-4 text-eyebrow text-muted-foreground">
            {REGION_LABEL[course.region]} · {p.kind}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-title font-semibold tracking-tight md:text-headline">{p.name}</h1>
            {l.status === "reserved" && (
              <Badge variant="secondary" className="px-3 py-1 text-small">{LISTING_STATUS_LABEL.reserved}</Badge>
            )}
          </div>
          <p className="mt-6 text-title font-semibold tracking-tight tabular-nums md:text-headline">{formatWon(l.asking_price)}</p>
          <p className="mt-1 text-body text-muted-foreground">호가 {formatKoreanPrice(l.asking_price)}</p>
        </div>

        <div className="bg-section py-10 md:py-16">
          <div className="mx-auto grid max-w-[1024px] gap-4 px-4 md:grid-cols-[minmax(0,1fr)_400px] md:items-start md:gap-6">
            <div className="flex flex-col gap-4 md:gap-6">
              <Tile className="bg-card p-6 md:p-8">
                <h2 className="text-eyebrow font-semibold tracking-tight">매물 정보</h2>
                <dl className="mt-4 divide-y divide-border/70 text-body">
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">골프장</dt><dd className="min-w-0">{course.name}</dd>
                  </div>
                  {course.address && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-20 shrink-0 text-muted-foreground">위치</dt><dd className="min-w-0">{course.address}</dd>
                    </div>
                  )}
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">종류</dt><dd>{p.kind}</dd>
                  </div>
                  <div className="flex gap-4 py-3.5">
                    <dt className="w-20 shrink-0 text-muted-foreground">호가</dt><dd className="tabular-nums">{formatWon(l.asking_price)}</dd>
                  </div>
                  {latest && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-20 shrink-0 text-muted-foreground">최근 시세</dt>
                      <dd className="tabular-nums">
                        매수 {formatKoreanPrice(latest.buy_price)} · 매도 {formatKoreanPrice(latest.sell_price)}
                        <span className="block text-small text-muted-foreground">{formatKstDate(latest.quoted_on)} 기준</span>
                      </dd>
                    </div>
                  )}
                  {l.description && (
                    <div className="flex gap-4 py-3.5">
                      <dt className="w-20 shrink-0 text-muted-foreground">설명</dt>
                      <dd className="min-w-0 whitespace-pre-wrap">{l.description}</dd>
                    </div>
                  )}
                </dl>
              </Tile>

              <Tile className="bg-card p-6 md:p-8">
                <section aria-labelledby="quotes-title">
                  <h2 id="quotes-title" className="text-eyebrow font-semibold tracking-tight">시세 이력</h2>
                  {quotes.length === 0 ? (
                    <p className="mt-4 text-body text-muted-foreground">아직 등록된 시세가 없습니다.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-small tabular-nums">
                        <caption className="sr-only">최근 {QUOTE_ROWS}건 시세(원)</caption>
                        <thead className="text-muted-foreground">
                          <tr className="border-b border-border/70">
                            <th scope="col" className="py-2.5 pr-3 font-medium">기준일</th>
                            <th scope="col" className="py-2.5 pr-3 text-right font-medium">매수</th>
                            <th scope="col" className="py-2.5 text-right font-medium">매도</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                          {quotes.map((q) => (
                            <tr key={q.id}>
                              <td className="py-2.5 pr-3 whitespace-nowrap">{formatKstDate(q.quoted_on)}</td>
                              <td className="py-2.5 pr-3 text-right whitespace-nowrap">{formatKoreanPrice(q.buy_price)}</td>
                              <td className="py-2.5 text-right whitespace-nowrap">{formatKoreanPrice(q.sell_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-4 text-micro text-muted-foreground">시세는 참고용이며 실제 거래가는 상담으로 정해집니다.</p>
                </section>
              </Tile>
            </div>

            <Tile className="bg-card p-6 md:p-8">
              <section aria-labelledby="inquiry-title">
                <h2 id="inquiry-title" className="mb-5 text-eyebrow font-semibold tracking-tight">매수 상담 신청</h2>
                {cta}
              </section>
            </Tile>
          </div>
          <p className="mx-auto mt-8 max-w-[1024px] px-4 text-center text-small text-muted-foreground">
            이 회원권을 갖고 계신가요?{" "}
            <Link href={`/memberships/sell?product=${p.id}` as never} className="text-primary hover:underline underline-offset-4">
              매도 상담 신청
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

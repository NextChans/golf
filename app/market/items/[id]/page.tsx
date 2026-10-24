import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FloatingInquiry } from "@/components/market/floating-inquiry";
import { RecordView } from "@/components/market/recent";
import { AppScreen, Divider } from "@/components/market/ui";
import { Admission } from "@/components/market/detail/admission";
import { BottomCta } from "@/components/market/detail/bottom-cta";
import { CostCalculator } from "@/components/market/detail/calculator";
import { CourseInfo } from "@/components/market/detail/course-info";
import { DealTables } from "@/components/market/detail/deals";
import { DetailFaq } from "@/components/market/detail/faq";
import { Features } from "@/components/market/detail/features";
import { DetailHero } from "@/components/market/detail/hero";
import { PriceCard } from "@/components/market/detail/price-card";
import { ReportBanner } from "@/components/market/detail/report-banner";
import { DetailSummary } from "@/components/market/detail/summary";
import { DetailTabs } from "@/components/market/detail/tabs";
import { DetailTopBar } from "@/components/market/detail/top-bar";
import { PriceTrend } from "@/components/market/detail/trend";
import { UsageInfo } from "@/components/market/detail/usage-info";
import { monthlySeries } from "@/lib/domain/market/detail";
import { currentPrice, weeklyChangeRate } from "@/lib/domain/market/schema";
import { findMarketItem, MARKET_ITEMS } from "@/lib/mock/market";
import { getMarketDetail, siblingKinds } from "@/lib/mock/market-detail";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const item = findMarketItem((await params).id);
  return { title: item?.courseName ?? "회원권" };
}

/** 섹션 앵커는 고정 영역(상단 바 56 + 탭 48)만큼 scroll-margin-top으로 보정한다 */
const SECTION = "scroll-mt-[6.5rem] px-6 py-8";

export default async function MarketItemPage({ params }: { params: Params }) {
  const item = findMarketItem((await params).id);
  if (!item) notFound();

  const detail = getMarketDetail(item);
  const quote = currentPrice(item);

  return (
    <AppScreen withTabBar={false} className="pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <DetailTopBar id={item.id} name={item.courseName} />
      <main>
        <RecordView id={item.id} />
        <DetailHero region={item.region} />
        <DetailSummary item={item} siblings={siblingKinds(MARKET_ITEMS, item)} />
        <PriceCard
          quote={quote}
          rate={weeklyChangeRate(item.weekly)}
          askPrice={item.askPrice}
          bidPrice={item.bidPrice}
          lastDeal={detail.deals[0]?.price ?? null}
        />
        <div className="h-8" />
        <DetailTabs />

        <section id="sec-price" aria-label="시세" className="scroll-mt-[6.5rem]">
          <div className="px-6 py-8"><PriceTrend monthly={monthlySeries(item)} /></div>
          <Divider />
          <div className="px-6 py-8">
            <DealTables rows={{ deals: detail.deals, listings: detail.listings, bids: detail.bids }} />
          </div>
        </section>
        <Divider />

        <section id="sec-membership" aria-label="회원권 정보" className={SECTION}>
          <Features features={detail.features} />
          <div className="mt-10">
            <Admission courseName={item.courseName} kind={item.kind} admission={detail.admission} companion={detail.companion} />
          </div>
        </section>
        <Divider />

        <section id="sec-usage" aria-label="이용 정보" className={SECTION}>
          <UsageInfo detail={detail} />
        </section>
        <Divider />

        <section id="sec-course" aria-label="골프장 정보" className="scroll-mt-[6.5rem]">
          <div className="px-6 py-8"><CourseInfo name={item.courseName} holes={item.holes} detail={detail} /></div>
          <Divider />
          <div id="calc" className="scroll-mt-[6.5rem] px-6 py-8">
            <CostCalculator kind={item.kind} quote={quote} />
          </div>
        </section>

        <ReportBanner />
        <DetailFaq />
      </main>

      <FloatingInquiry position="cta" topButton />
      <BottomCta itemId={item.id} />
    </AppScreen>
  );
}

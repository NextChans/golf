import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseAvatar, TypeRows } from "@/components/market/course/type-rows";
import { CourseTopBar } from "@/components/market/course/course-top-bar";
import { CourseInfo } from "@/components/market/detail/course-info";
import { DetailHero } from "@/components/market/detail/hero";
import { FloatingInquiry } from "@/components/market/floating-inquiry";
import { AppScreen, Divider, primaryButtonClass } from "@/components/market/ui";
import { findCourseGroup } from "@/lib/domain/market/group";
import { MARKET_REGION_LABEL } from "@/lib/domain/market/schema";
import { MARKET_ITEMS } from "@/lib/mock/market";
import { getCourseDetail } from "@/lib/mock/market-detail";

type Params = Promise<{ courseId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const group = findCourseGroup(MARKET_ITEMS, (await params).courseId);
  return { title: group?.courseName ?? "골프장" };
}

/** 골프장 상세(D-89): 사진 자리 · 유형 행 목록 · 골프장 정보 · 하단 고정 CTA */
export default async function MarketCoursePage({ params }: { params: Params }) {
  const group = findCourseGroup(MARKET_ITEMS, (await params).courseId);
  const detail = group && getCourseDetail(MARKET_ITEMS, group.courseId);
  if (!group || !detail) notFound();

  return (
    <AppScreen withTabBar={false} className="pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <CourseTopBar name={group.courseName} />
      <main>
        <DetailHero region={group.region} className="h-[240px]" />
        <section aria-label="골프장 요약" className="relative -mt-6 rounded-t-sheet bg-surface px-6 pt-6">
          <div className="flex items-center gap-3">
            <CourseAvatar name={group.courseName} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-heading font-bold text-ink">{group.courseName}</h1>
              <p className="text-caption font-semibold text-ink-sub">{MARKET_REGION_LABEL[group.region]}·{group.holes}홀</p>
            </div>
          </div>
          <TypeRows items={group.items} courseName={group.courseName} bordered className="mt-6 pb-10" />
        </section>
        <Divider />
        <section aria-label="골프장 정보" className="px-6 py-8">
          <CourseInfo name={group.courseName} holes={group.holes} detail={detail} />
        </section>
      </main>

      <FloatingInquiry position="cta" topButton />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe">
        <div className="mx-auto max-w-[480px] px-6 py-3">
          <Link href={`/market/search/results?q=${encodeURIComponent(group.courseName)}`} className={`${primaryButtonClass} w-full`}>
            지금 가장 핫한 매물 보러가기
          </Link>
        </div>
      </div>
    </AppScreen>
  );
}

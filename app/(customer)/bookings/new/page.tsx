import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { addDaysIso, MAX_ADVANCE_DAYS, todayKst } from "@/lib/domain/booking/schema";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "부킹 요청" };

export default async function NewBookingPage() {
  await requireCustomer();
  const supabase = await createClient();
  const { data: courses, error } = await supabase
    .from("golf_courses").select("id, name, region").eq("is_active", true).order("name");
  const today = todayKst();

  return (
    <>
      <GlobalNav />
      <LocalNav title="부킹 요청" />
      <main className="mx-auto max-w-[560px] px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mb-10 text-center md:mb-14">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">부킹 요청</h1>
          <p className="mt-3 text-eyebrow text-muted-foreground">
            영업시간(평일 09~18시) 기준 30분 안에 담당자가 확인을 시작합니다.
          </p>
        </div>
        {error ? (
          <Tile className="text-center">
            <p role="alert" className="text-body text-destructive">골프장 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>
          </Tile>
        ) : (
          // 멱등키는 렌더마다 새로 발급. 같은 폼의 중복 제출은 같은 키로 들어와 1건만 생성된다(D-10).
          <BookingForm
            idempotencyKey={randomUUID()}
            courses={courses ?? []}
            minDate={today}
            maxDate={addDaysIso(today, MAX_ADVANCE_DAYS)}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

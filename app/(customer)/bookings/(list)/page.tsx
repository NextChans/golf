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
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT, describeTimePref } from "@/lib/domain/booking/status";

export const metadata: Metadata = { title: "내 예약" };

export default async function BookingsPage() {
  await requireCustomer();
  const supabase = await createClient();
  // 목록 1회 조회(골프장명은 FK embedding). RLS가 본인 행만 돌려준다.
  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("id, status, play_date, time_pref, time_from, time_to, players, course_name_free, created_at, golf_courses(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <GlobalNav />
      <LocalNav
        title="내 예약"
        action={<Button asChild size="sm"><Link href="/bookings/new">새 요청</Link></Button>}
      />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-12 pb-10 md:pt-20 md:pb-14">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">내 예약</h1>
          <p className="mt-3 max-w-[560px] text-eyebrow text-muted-foreground">
            요청한 부킹의 진행 상황과 담당자 제안을 한곳에서 확인하세요.
          </p>
        </div>

        <section className="bg-section py-10 md:py-16" aria-label="예약 목록">
          <div className="mx-auto max-w-[1024px] px-4">
            {error ? (
              <Tile className="bg-card text-center">
                <p role="alert" className="text-eyebrow text-destructive">
                  예약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
                <Button asChild variant="secondary" className="mt-6"><Link href="/bookings">다시 시도</Link></Button>
              </Tile>
            ) : !bookings?.length ? (
              <Tile className="bg-card px-6 py-14 text-center md:py-20">
                <h2 className="text-eyebrow font-semibold tracking-tight md:text-title">아직 요청한 예약이 없습니다</h2>
                <p className="mx-auto mt-3 max-w-[420px] text-body text-muted-foreground">
                  원하는 골프장과 날짜를 알려주시면 담당자가 티타임을 찾아 드립니다.
                </p>
                <Button asChild className="mt-8"><Link href="/bookings/new">첫 부킹 요청하기</Link></Button>
              </Tile>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="pressable group flex min-h-[104px] items-center gap-4 rounded-tile bg-card p-5 outline-none hover:bg-card/70 focus-visible:ring-4 focus-visible:ring-ring/40 md:p-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-eyebrow font-semibold tracking-tight">
                            {b.golf_courses?.name ?? b.course_name_free ?? "골프장 미정"}
                          </p>
                          <Badge variant={BOOKING_STATUS_VARIANT[b.status]} className="mt-0.5 px-2.5 py-1 text-micro">
                            {BOOKING_STATUS_LABEL[b.status]}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-small text-muted-foreground">
                          {formatKstDate(b.play_date)} · {describeTimePref(b.time_pref, b.time_from, b.time_to)} · {b.players}명
                        </p>
                      </div>
                      <span aria-hidden className="text-eyebrow text-muted-foreground transition group-hover:translate-x-0.5">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

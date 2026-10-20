import type { Metadata } from "next";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
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
      <CustomerHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">내 예약</h1>
          <Button asChild><Link href="/bookings/new">새 요청</Link></Button>
        </div>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
            예약 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
          </p>
        ) : !bookings?.length ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">아직 요청한 예약이 없습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">원하는 골프장과 날짜를 알려주시면 담당자가 티타임을 찾아 드립니다.</p>
            <Button asChild className="mt-4"><Link href="/bookings/new">첫 부킹 요청하기</Link></Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="block rounded-xl border p-4 transition hover:bg-muted/60">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{b.golf_courses?.name ?? b.course_name_free ?? "골프장 미정"}</p>
                    <Badge variant={BOOKING_STATUS_VARIANT[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatKstDate(b.play_date)} · {describeTimePref(b.time_pref, b.time_from, b.time_to)} · {b.players}명
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

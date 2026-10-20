import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { Button } from "@/components/ui/button";

// 없거나 남의 예약(RLS로 0행)은 같은 화면으로 응답한다(존재 여부 비노출).
export default function BookingNotFound() {
  return (
    <>
      <CustomerHeader />
      <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-16">
        <h1 className="text-xl font-bold">예약을 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">주소가 정확한지 확인해 주세요.</p>
        <Button asChild><Link href="/bookings">내 예약으로</Link></Button>
      </main>
    </>
  );
}

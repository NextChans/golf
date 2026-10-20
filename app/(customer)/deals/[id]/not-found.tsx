import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";

// 없거나 남의 거래(RLS로 0행)는 같은 화면으로 응답한다(존재 여부 비노출).
export default function DealNotFound() {
  return (
    <>
      <GlobalNav />
      <main className="mx-auto flex min-h-[60vh] max-w-[1024px] flex-col items-center justify-center px-4 py-20 text-center md:py-28">
        <h1 className="text-title font-semibold tracking-tight md:text-headline">거래를 찾을 수 없습니다</h1>
        <p className="mt-3 text-eyebrow text-muted-foreground">주소가 정확한지 확인해 주세요.</p>
        <Button asChild className="mt-8"><Link href="/deals">내 거래로</Link></Button>
      </main>
      <SiteFooter />
    </>
  );
}

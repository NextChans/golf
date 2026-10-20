import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";

// 없거나 비공개(hidden)·판매 완료 매물은 같은 화면으로 응답한다(존재 여부 비노출).
export default function ListingNotFound() {
  return (
    <>
      <GlobalNav />
      <main className="mx-auto flex min-h-[60vh] max-w-[1024px] flex-col items-center justify-center px-4 py-20 text-center md:py-28">
        <h1 className="text-title font-semibold tracking-tight md:text-headline">매물을 찾을 수 없습니다</h1>
        <p className="mt-3 text-eyebrow text-muted-foreground">판매가 끝났거나 공개되지 않은 매물입니다.</p>
        <Button asChild className="mt-8"><Link href="/memberships">회원권 매물로</Link></Button>
      </main>
      <SiteFooter />
    </>
  );
}

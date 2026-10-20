import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** 고객 화면 공통 헤더(모바일 우선). 로그아웃은 POST 폼. */
export function CustomerHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="고객 메뉴">
          <Button asChild variant="ghost" size="sm"><Link href="/bookings">내 예약</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/me">내 정보</Link></Button>
        </nav>
      </div>
    </header>
  );
}

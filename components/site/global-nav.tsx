import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getSession } from "@/lib/auth/guards";

/** apple.com 글로벌 내비게이션: 얇은(48px) 반투명 바, 작은 링크. */
export async function GlobalNav() {
  const session = await getSession();
  const signedInCustomer = session?.role === "customer";
  return (
    <header className="sticky top-0 z-40 bg-nav backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-12 max-w-[1024px] items-center justify-between px-4 text-micro" aria-label="전체 메뉴">
        <Logo size="sm" />
        <div className="flex items-center gap-5 text-foreground/80">
          <Link className="pressable hover:text-foreground" href="/bookings/new">부킹</Link>
          {signedInCustomer ? (
            <>
              <Link className="pressable hover:text-foreground" href="/bookings">내 예약</Link>
              <Link className="pressable hover:text-foreground" href="/me">내 정보</Link>
            </>
          ) : (
            <Link className="pressable hover:text-foreground" href="/login">로그인</Link>
          )}
        </div>
      </nav>
    </header>
  );
}

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/guards";

const navLink = "pressable inline-flex h-11 shrink-0 items-center text-foreground/80 hover:text-foreground";

// 운영자 콘솔 공통 레이아웃. middleware와 별개로 서버에서 역할·aal2를 다시 검사한다(절대 규칙 7).
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="material-bar scroll-edge sticky top-0 z-40">
        <div className="mx-auto flex h-12 max-w-[1024px] items-center justify-between gap-2 px-4 text-micro">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="flex shrink-0 items-center gap-2">
              <Logo href="/admin" size="sm" />
              <Badge variant="secondary">{session.role === "owner" ? "최고관리자" : "운영자"}</Badge>
            </div>
            <nav className="flex min-w-0 items-center gap-3 overflow-x-auto sm:gap-5" aria-label="운영자 메뉴">
              <Link className={navLink} href="/admin/deals">회원권 상담</Link>
              <Link className={navLink} href="/admin/customers">고객</Link>
              <Link className={navLink} href="/admin/courses">골프장</Link>
              <Link className={navLink} href="/admin/memberships">매물·시세</Link>
              <Link className={navLink} href="/admin/notifications">알림</Link>
              <Link className={navLink} href="/admin/community">커뮤니티</Link>
              {session.role === "owner" && <Link className={navLink} href="/admin/staff">운영자 관리</Link>}
            </nav>
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="secondary" size="xs" type="submit" className="relative h-8 px-3.5 after:absolute after:inset-x-0 after:-inset-y-1.5">로그아웃</Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1024px] flex-1 px-4 py-10 md:py-14">{children}</main>
    </div>
  );
}

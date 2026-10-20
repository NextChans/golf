import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/guards";

// 운영자 콘솔 공통 레이아웃. middleware와 별개로 서버에서 역할·aal2를 다시 검사한다(절대 규칙 7).
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo href="/admin" />
            <Badge variant="secondary">{session.role === "owner" ? "최고관리자" : "운영자"}</Badge>
          </div>
          <form action="/auth/signout" method="post"><Button variant="ghost" size="sm" type="submit">로그아웃</Button></form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm" aria-label="운영자 메뉴">
          <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/admin">홈</Link>
          {session.role === "owner" && <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/admin/staff">운영자 관리</Link>}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

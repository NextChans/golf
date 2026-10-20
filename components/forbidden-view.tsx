import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function ForbiddenView() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-4">
      <Logo />
      <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
      <p className="text-muted-foreground">이 페이지는 Googolf 운영자 전용입니다. 다른 계정으로 로그인하려면 로그아웃 후 다시 시도하세요.</p>
      <div className="flex gap-2">
        <Button asChild><Link href="/">홈으로</Link></Button>
        <form action="/auth/signout" method="post"><Button variant="outline" type="submit">로그아웃</Button></form>
      </div>
    </main>
  );
}

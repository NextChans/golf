import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function ForbiddenView() {
  return (
    <>
      <header className="sticky top-0 z-40 bg-nav backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-[1024px] items-center px-4">
          <Logo size="sm" />
        </div>
      </header>
      <main className="flex min-h-[calc(100dvh-3rem)] items-center justify-center px-4 py-16">
        <div className="mx-auto w-full max-w-[560px] text-center">
          <p className="text-eyebrow font-semibold text-muted-foreground">403</p>
          <h1 className="mt-3 text-title tracking-tight md:text-headline">접근 권한이 없습니다</h1>
          <p className="mt-4 text-body text-muted-foreground">
            이 페이지는 Googolf 운영자 전용입니다. 다른 계정으로 로그인하려면 로그아웃 후 다시 시도하세요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild><Link href="/">홈으로</Link></Button>
            <form action="/auth/signout" method="post">
              <Button variant="outline" type="submit">로그아웃</Button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

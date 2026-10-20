import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/guards";

export default async function Home() {
  const session = await getSession();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        {session ? (
          <Button asChild variant="ghost" size="sm"><Link href="/me">내 정보</Link></Button>
        ) : (
          <Button asChild variant="ghost" size="sm"><Link href="/login">로그인</Link></Button>
        )}
      </header>
      <section className="flex flex-1 flex-col justify-center gap-4 py-12">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
          전화 없이,<br />원하는 티타임을 요청하세요
        </h1>
        <p className="text-muted-foreground">
          골프장·날짜·인원만 알려주시면 담당자가 확인해 티타임을 제안해 드립니다. 회원권 매수·매도 상담도 온라인으로 접수하세요.
        </p>
        <Button asChild size="lg" className="mt-4">
          <Link href={session ? "/me" : "/login"}>시작하기</Link>
        </Button>
      </section>
      <footer className="text-xs text-muted-foreground">© Googolf</footer>
    </main>
  );
}

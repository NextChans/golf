import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { GlobalNav } from "@/components/site/global-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { KakaoButton } from "./kakao-button";
import { signInWithKakao } from "./actions";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <GlobalNav />
      <main className="flex min-h-[calc(100dvh-3rem)] flex-col">
        <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-4 py-16 text-center md:py-24">
          <Logo />
          <h1 className="mt-8 text-title tracking-tight">Googolf에 로그인</h1>
          <p className="mt-3 text-body text-muted-foreground">
            카카오 계정 하나로 회원권 상담과 골프 모임을 시작하세요.
          </p>
          {error && (
            <div role="alert" className="mt-8 w-full rounded-tile bg-destructive/10 px-5 py-4 text-left text-small text-destructive">
              {error}
            </div>
          )}
          <form action={signInWithKakao} className="mt-8 w-full">
            <input type="hidden" name="next" value={next ?? ""} />
            <KakaoButton />
          </form>
          <p className="mt-6 text-micro text-muted-foreground">
            처음이시면 로그인 후 이름 입력과 약관 동의를 한 번만 진행합니다.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

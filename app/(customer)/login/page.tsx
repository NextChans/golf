import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KakaoButton } from "./kakao-button";
import { signInWithKakao } from "./actions";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <Logo />
      <section className="flex flex-1 flex-col justify-center gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">로그인</h1>
          <p className="text-muted-foreground">카카오 계정으로 간편하게 시작하세요. 처음이시면 휴대폰 인증과 약관 동의를 한 번 진행합니다.</p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form action={signInWithKakao}>
          <input type="hidden" name="next" value={next ?? ""} />
          <KakaoButton />
        </form>
      </section>
    </main>
  );
}

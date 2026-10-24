import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KakaoButton } from "@/app/(customer)/login/kakao-button";
import { signInWithKakao } from "@/app/(customer)/login/actions";
import { AppScreen, TopBar } from "@/components/market/ui";
import { getSession } from "@/lib/auth/guards";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = { title: "로그인" };

type SearchParams = Promise<{ next?: string; error?: string }>;

/**
 * 회원권 앱 로그인(D-81). 고객 로그인은 카카오만 쓴다(이메일·네이버·구글·애플은 추후).
 * 카카오 OAuth·온보딩은 기존 흐름(/auth/callback → /onboarding)을 그대로 쓴다.
 */
export default async function MarketLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  const to = safeNext(next, "/market/mypage");
  const session = await getSession();
  if (session?.role === "customer") redirect(to as never);

  return (
    <AppScreen withTabBar={false}>
      <TopBar title="" back="/market/mypage" />
      <main className="flex flex-col items-center px-6 pt-10 pb-12">
        <svg viewBox="0 0 64 64" className="size-24" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#1B6B45" />
          <ellipse cx="32" cy="46" rx="20" ry="6" fill="#C6E26B" />
          <ellipse cx="32" cy="46" rx="4.5" ry="1.8" fill="#0F3D27" />
          <rect x="31" y="14" width="2.4" height="32" rx="1.2" fill="#FFFFFF" />
          <path d="M33.4 14 L48 19.5 L33.4 25 Z" fill="#C6E26B" />
        </svg>
        <h1 className="mt-4 text-display font-extrabold text-brand-ink">Googolf</h1>
        <p className="mt-3 text-center text-label text-ink-sub">카카오 계정 하나로 시세 확인부터<br />회원권 거래 상담까지 시작하세요.</p>

        {error && (
          <p role="alert" className="mt-8 w-full rounded-control bg-up/10 px-4 py-3 text-caption font-semibold text-up">{error}</p>
        )}
        <form action={signInWithKakao} className="mt-10 w-full">
          <input type="hidden" name="next" value={to} />
          <KakaoButton label="카카오로 계속하기" className="h-14 rounded-control text-subhead font-bold" />
        </form>

        <p className="mt-8 text-caption text-ink-mute">
          처음이신가요?{" "}
          <Link href={`/market/signup?next=${encodeURIComponent(to)}` as never} className="font-bold text-ink-sub underline underline-offset-4">회원가입</Link>
        </p>
      </main>
    </AppScreen>
  );
}

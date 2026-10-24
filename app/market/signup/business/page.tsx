import type { Metadata } from "next";
import { KakaoButton } from "@/app/(customer)/login/kakao-button";
import { signInWithKakao } from "@/app/(customer)/login/actions";
import { BusinessSignup } from "@/components/market/business-signup";
import { AppScreen, TopBar } from "@/components/market/ui";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = { title: "기업 회원가입" };

type SearchParams = Promise<{ next?: string }>;

export default async function BusinessSignupPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNext((await searchParams).next, "/market/mypage");
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="기업 회원가입" back="/market/signup" />
      <BusinessSignup
        kakao={
          <form action={signInWithKakao}>
            <input type="hidden" name="next" value={next} />
            <KakaoButton label="카카오로 계속하기" className="h-14 rounded-control text-subhead font-bold" />
          </form>
        }
      />
    </AppScreen>
  );
}

import type { Metadata } from "next";
import { KakaoButton } from "@/app/(customer)/login/kakao-button";
import { signInWithKakao } from "@/app/(customer)/login/actions";
import { AppScreen, Stepper, TopBar } from "@/components/market/ui";
import { safeNext } from "@/lib/auth/routing";
import { SIGNUP_STEPS } from "@/lib/domain/market/business";

export const metadata: Metadata = { title: "개인 회원가입" };

type SearchParams = Promise<{ next?: string }>;

/** 개인 가입 1단계: 카카오 계정 연결. 2단계(이름·연락처·약관)는 기존 /onboarding이 맡는다 */
export default async function PersonalSignupPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNext((await searchParams).next, "/market/mypage");
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="개인 회원가입" back="/market/signup" />
      <Stepper steps={SIGNUP_STEPS} current={0} />
      <main className="px-6 pt-4 pb-12">
        <h2 className="text-heading font-extrabold text-ink">카카오 계정으로<br />간편하게 가입하세요</h2>
        <p className="mt-2 text-caption text-ink-mute">다음 단계에서 이름·연락처를 입력하고 약관에 동의하면 가입이 끝나요.</p>
        <form action={signInWithKakao} className="mt-10">
          <input type="hidden" name="next" value={next} />
          <KakaoButton label="카카오로 계속하기" className="h-14 rounded-control text-subhead font-bold" />
        </form>
        <p className="mt-6 text-center text-tiny text-ink-faint">
          다른 가입 방법은 준비 중이에요. Googolf는 주민등록번호·신분증을 수집하지 않습니다.
        </p>
      </main>
    </AppScreen>
  );
}

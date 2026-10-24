import type { Metadata } from "next";
import { AppScreen, StateView, Stepper, TopBar } from "@/components/market/ui";
import { createClient } from "@/lib/supabase/server";
import { requireSignedInCustomer } from "@/lib/auth/guards";
import { safeNext } from "@/lib/auth/routing";
import { SIGNUP_STEPS } from "@/lib/domain/market/business";
import { pickDefaultName } from "@/lib/domain/market/signup";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "회원가입" };

/** 가입 2단계(정보 입력)와 3단계(환영 화면). 회원권 앱 디자인 시스템(D-82, docs/DESIGN-APP.md) */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireSignedInCustomer();
  const { next } = await searchParams;
  const supabase = await createClient();
  const [{ data: terms, error }, { data: userData }, { data: phoneSetting }] = await Promise.all([
    supabase.from("current_terms").select("code, version, title, required").order("required", { ascending: false }),
    supabase.auth.getUser(),
    supabase.from("app_settings").select("value").eq("key", "phone_verification_required").maybeSingle(),
  ]);
  // 설정을 못 읽으면 안전한 쪽(인증 필수)으로 본다. 최종 판단은 DB 함수가 한다(D-42).
  const phoneRequired = phoneSetting ? phoneSetting.value === true : true;
  const user = userData.user;

  if (error || !terms) {
    return (
      <AppScreen withTabBar={false}>
        <TopBar title="회원가입" />
        <Stepper steps={SIGNUP_STEPS} current={1} />
        <StateView tone="error" title="약관 정보를 불러오지 못했어요" body="잠시 후 새로고침해 주세요." />
      </AppScreen>
    );
  }

  return (
    <AppScreen withTabBar={false}>
      <OnboardingForm
        terms={terms.flatMap((t) => (t.code && t.title ? [{ code: t.code, title: t.title, required: !!t.required }] : []))}
        verifiedPhone={user?.phone_confirmed_at && user.phone ? `+${user.phone.replace(/^\+/, "")}` : null}
        next={safeNext(next, "/me")}
        phoneRequired={phoneRequired}
        // 카카오 닉네임은 이름 칸의 기본값으로만 쓴다(권한 판단에 쓰지 않음, D-82)
        defaultName={pickDefaultName(user?.user_metadata)}
      />
    </AppScreen>
  );
}

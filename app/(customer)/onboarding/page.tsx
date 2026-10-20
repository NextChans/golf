import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { requireSignedInCustomer } from "@/lib/auth/guards";
import { safeNext } from "@/lib/auth/routing";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "가입 마무리" };

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">가입 마무리</h1>
        <p className="text-sm text-muted-foreground">
          {phoneRequired ? "예약 확정 안내를 받을 휴대폰 번호를 인증하고 약관에 동의해 주세요." : "예약자 이름을 입력하고 약관에 동의해 주세요."}
        </p>
      </div>
      {error || !terms ? (
        <p role="alert" className="text-sm text-destructive">약관 정보를 불러오지 못했습니다. 새로고침해 주세요.</p>
      ) : (
        <OnboardingForm
          terms={terms.flatMap((t) => (t.code && t.title ? [{ code: t.code, title: t.title, required: !!t.required }] : []))}
          verifiedPhone={userData.user?.phone_confirmed_at && userData.user.phone ? `+${userData.user.phone.replace(/^\+/, "")}` : null}
          next={safeNext(next, "/me")}
          phoneRequired={phoneRequired}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Googolf는 주민등록번호·신분증·인감 등 고유식별정보를 수집하지 않습니다.
      </p>
    </main>
  );
}

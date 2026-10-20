import type { Metadata } from "next";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { MoreLink, Section, Tile } from "@/components/site/section";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { ContactRow } from "./contact-form";

export const metadata: Metadata = { title: "내 정보" };

export default async function MePage() {
  const session = await requireCustomer();
  const supabase = await createClient();
  const [{ data: profile, error }, { data: phoneSetting }] = await Promise.all([
    supabase.from("profiles").select("display_name, phone, phone_verified_at").eq("id", session.userId).maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "phone_verification_required").maybeSingle(),
  ]);
  // 인증 필수 모드에서는 직접 변경 불가(인증 절차로만). 설정을 못 읽으면 변경을 막는 쪽으로 본다.
  const contactEditable = phoneSetting ? phoneSetting.value === false : false;

  return (
    <>
      <GlobalNav />
      <LocalNav title="내 정보" />
      <main>
        <Section tone="white" className="py-12 md:py-20" inner="max-w-[720px]">
          <h1 className="text-title tracking-tight">개인 정보</h1>
          <p className="mt-2 text-body text-muted-foreground">예약 확인 전화와 확정 안내에 사용하는 정보입니다.</p>
          <Tile className="mt-8 p-0 md:p-0">
            {error || !profile ? (
              <p role="alert" className="px-6 py-5 text-body text-destructive">정보를 불러오지 못했습니다.</p>
            ) : (
              <dl className="divide-y divide-border/70">
                <div className="flex min-h-14 items-center justify-between gap-4 px-6 py-4">
                  <dt className="text-body text-muted-foreground">이름</dt>
                  <dd className="text-right text-body">{profile.display_name}</dd>
                </div>
                <ContactRow phone={profile.phone} verified={!!profile.phone_verified_at} editable={contactEditable} />
              </dl>
            )}
          </Tile>
          <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <MoreLink href="/bookings" className="text-body">내 예약 보기</MoreLink>
            <form action="/auth/signout" method="post">
              <Button variant="secondary" type="submit">로그아웃</Button>
            </form>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}

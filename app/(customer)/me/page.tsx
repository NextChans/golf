import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { formatPhone } from "@/lib/domain/phone";

export const metadata: Metadata = { title: "내 정보" };

export default async function MePage() {
  const session = await requireCustomer();
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles").select("display_name, phone").eq("id", session.userId).maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <form action="/auth/signout" method="post"><Button variant="ghost" size="sm" type="submit">로그아웃</Button></form>
      </header>
      <Card>
        <CardHeader><CardTitle>내 정보</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {error || !profile ? (
            <p role="alert" className="text-destructive">정보를 불러오지 못했습니다.</p>
          ) : (
            <>
              <p>이름: {profile.display_name}</p>
              <p>휴대폰: {formatPhone(profile.phone)}</p>
            </>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">부킹 요청과 회원권 상담은 곧 열립니다.</p>
    </main>
  );
}

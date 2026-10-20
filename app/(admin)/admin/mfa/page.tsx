import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/guards";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "OTP 인증", robots: { index: false } };

export default async function MfaPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin" && session.role !== "owner") forbidden();
  if (session.passwordChangeRequired) redirect("/admin/password");
  if (session.aal === "aal2") redirect("/admin");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <Logo href="/admin" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">OTP 인증</h1>
        <p className="text-sm text-muted-foreground">운영자 화면은 OTP 2단계 인증 후에만 열립니다.</p>
      </div>
      <MfaForm />
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="ghost" size="sm">다른 계정으로 로그인</Button>
      </form>
    </main>
  );
}

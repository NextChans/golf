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
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-12 w-full max-w-[1024px] items-center px-4">
        <Logo href="/admin" size="sm" />
      </header>
      <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-12 md:py-20">
        <div className="text-center">
          <p className="text-small font-semibold text-muted-foreground">Googolf 운영 콘솔</p>
          <h1 className="mt-2 text-title tracking-tight">OTP 인증</h1>
          <p className="mt-3 text-body text-muted-foreground">운영자 화면은 OTP 2단계 인증 후에만 열립니다.</p>
        </div>
        <div className="mt-10">
          <MfaForm />
        </div>
        <form action="/auth/signout" method="post" className="mt-6 flex justify-center">
          <Button type="submit" variant="ghost">다른 계정으로 로그인</Button>
        </form>
      </section>
    </main>
  );
}

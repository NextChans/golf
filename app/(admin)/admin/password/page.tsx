import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getSession } from "@/lib/auth/guards";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "비밀번호 변경", robots: { index: false } };

export default async function PasswordPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin" && session.role !== "owner") forbidden();
  if (!session.passwordChangeRequired) redirect("/admin");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-12 w-full max-w-[1024px] items-center px-4">
        <Logo href="/admin" size="sm" />
      </header>
      <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-12 md:py-20">
        <div className="text-center">
          <p className="text-small font-semibold text-muted-foreground">Googolf 운영 콘솔</p>
          <h1 className="mt-2 text-title tracking-tight">비밀번호 변경</h1>
          <p className="mt-3 text-body text-muted-foreground">임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 정해 주세요.</p>
        </div>
        <div className="mt-10">
          <PasswordForm />
        </div>
      </section>
    </main>
  );
}

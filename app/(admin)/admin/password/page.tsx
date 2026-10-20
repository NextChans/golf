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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <Logo href="/admin" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">비밀번호 변경</h1>
        <p className="text-sm text-muted-foreground">임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 정해 주세요.</p>
      </div>
      <PasswordForm />
    </main>
  );
}

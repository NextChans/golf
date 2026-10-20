import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { safeNext } from "@/lib/auth/routing";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "운영자 로그인", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">운영자 로그인</h1>
        <p className="text-sm text-muted-foreground">발급받은 운영자 계정으로 로그인하세요. 로그인 후 OTP 인증이 필요합니다.</p>
      </div>
      <AdminLoginForm next={safeNext(next, "/admin")} />
    </main>
  );
}

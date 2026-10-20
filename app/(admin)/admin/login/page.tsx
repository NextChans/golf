import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { safeNext } from "@/lib/auth/routing";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "운영자 로그인", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-12 w-full max-w-[1024px] items-center px-4">
        <Logo size="sm" />
      </header>
      <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-12 md:py-20">
        <div className="text-center">
          <p className="text-small font-semibold text-muted-foreground">Googolf 운영 콘솔</p>
          <h1 className="mt-2 text-title tracking-tight">운영자 로그인</h1>
          <p className="mt-3 text-body text-muted-foreground">발급받은 운영자 계정으로 로그인하세요. 로그인 후 OTP 인증이 필요합니다.</p>
        </div>
        <div className="mt-10">
          <AdminLoginForm next={safeNext(next, "/admin")} />
        </div>
      </section>
    </main>
  );
}

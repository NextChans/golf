import type { Metadata } from "next";
import Link from "next/link";
import { UserRound, UsersRound } from "lucide-react";
import { AppScreen, TopBar } from "@/components/market/ui";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = { title: "신규 회원가입" };

type SearchParams = Promise<{ next?: string }>;

export default async function SignupTypePage({ searchParams }: { searchParams: SearchParams }) {
  const next = encodeURIComponent(safeNext((await searchParams).next, "/market/mypage"));
  const types = [
    { href: `/market/signup/personal?next=${next}`, icon: UserRound, title: "개인회원", fill: true, desc: "개인 명의로 회원권 거래를 희망하는 경우" },
    { href: `/market/signup/business?next=${next}`, icon: UsersRound, title: "기업회원", desc: "법인 명의로 회원권 거래를 희망하는 경우", fill: false },
  ];
  return (
    <AppScreen withTabBar={false} tone="canvas">
      <TopBar title="신규 회원가입" back="/market/login" />
      <main className="px-6 pt-6 pb-12">
        <p className="text-center text-label font-semibold text-ink-sub">원하시는 회원 유형을 선택해주세요.</p>
        <ul className="mt-6 space-y-4">
          {types.map(({ href, icon: Icon, title, desc, fill }) => (
            <li key={title}>
              <Link href={href as never} className="pressable flex flex-col items-center rounded-sheet bg-surface px-6 py-8 text-center shadow-[0_4px_20px_-12px_rgb(0_0_0/0.15)]">
                <Icon className={`size-9 text-ink-sub ${fill ? "fill-ink-sub" : ""}`} strokeWidth={2.2} aria-hidden />
                <span className="mt-3 text-heading font-bold text-ink">{title}</span>
                <span className="mt-1 text-caption font-medium text-ink-mute">{desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppScreen>
  );
}

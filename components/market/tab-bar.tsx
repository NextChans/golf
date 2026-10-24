"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpDown, IdCard, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/market", label: "회원권 거래", icon: ArrowUpDown, match: (p: string) => p === "/market" || p.startsWith("/market/items") },
  { href: "/market/search", label: "회원권 검색", icon: Search, match: (p: string) => p.startsWith("/market/search") },
  { href: "/market/my", label: "나의 회원권", icon: IdCard, match: (p: string) => p.startsWith("/market/my") && !p.startsWith("/market/mypage") },
  { href: "/market/mypage", label: "마이페이지", icon: UserRound, match: (p: string) => p.startsWith("/market/mypage") },
] as const;

/** 하단 탭 바(4개 고정). 활성 탭은 브랜드 그린, 나머지는 회색. iOS 홈 인디케이터만큼 아래 여백 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="앱 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t font-app border-line bg-surface pb-safe">
      <ul className="mx-auto grid h-16 max-w-[480px] grid-cols-4">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable flex h-full flex-col items-center justify-center gap-1 text-tiny font-semibold",
                  active ? "text-brand" : "text-ink-mute",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

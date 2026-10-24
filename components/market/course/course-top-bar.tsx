"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * 골프장 상세 상단 바: 뒤로가기 + 왼쪽 정렬 제목(스크롤 시 고정).
 * 뒤로가기는 직전 화면(검색 결과·회원권 상세)으로 돌아가고, 기록이 없으면(직접 진입) 검색 결과로 간다.
 */
export function CourseTopBar({ name }: { name: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-surface">
      <div className="flex h-14 items-center gap-1 px-2">
        <Link
          href="/market/search/results"
          aria-label="뒤로"
          onClick={(e) => {
            if (window.history.length > 1) { e.preventDefault(); router.back(); }
          }}
          className="pressable flex size-11 shrink-0 items-center justify-center text-ink"
        >
          <ChevronLeft className="size-7" aria-hidden />
        </Link>
        <p className="min-w-0 truncate text-subhead font-bold text-ink-sub">{name}</p>
      </div>
    </header>
  );
}

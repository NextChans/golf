"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp, Phone } from "lucide-react";

/**
 * 떠 있는 버튼: "상담 문의"(항상) + "맨 위로"(스크롤 300px 이상일 때만).
 * 하단 고정 CTA(높이 약 81px + 안전영역) 바로 위에 떠 있어 겹치지 않는다.
 */
export function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30">
      <div className="mx-auto flex max-w-[480px] items-center justify-end gap-2 px-4">
        <Link
          href="/market/mypage/support"
          className="pressable pointer-events-auto flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-label font-bold text-surface shadow-lg"
        >
          <Phone aria-hidden className="size-5" />
          상담 문의
        </Link>
        {showTop && (
          <button
            type="button"
            aria-label="맨 위로"
            onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
            className="pressable pointer-events-auto flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lg"
          >
            <ArrowUp aria-hidden className="size-6" />
          </button>
        )}
      </div>
    </div>
  );
}

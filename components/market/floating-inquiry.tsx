"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/** 스크롤을 멈추고 이 시간이 지나면 다시 펼친다 */
const EXPAND_AFTER_MS = 1200;
/** 이만큼 이상 내려가야(px) 접는다. 작은 흔들림은 무시 */
const COLLAPSE_DELTA = 6;
const TOP_AFTER = 300;

/**
 * 떠 있는 위치(D-89). 모두 화면 맨 아래 기준이라 안전영역(env)을 더한다.
 * - tab: 하단 탭 바(4rem) 바로 위
 * - cta: 하단 고정 CTA(높이 약 81px) 바로 위
 * - stacked: 하단 중앙 필터 버튼(48px) 위. 필터 버튼과 겹치지 않게 위아래로 어긋남
 */
const POSITION = {
  tab: "bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]",
  cta: "bottom-[calc(6rem+env(safe-area-inset-bottom))]",
  stacked: "bottom-[calc(1rem+env(safe-area-inset-bottom)+3.75rem)]",
} as const;

/**
 * "상담 문의" 떠 있는 버튼(앱 주요 화면 공용, D-89). 링크 → 고객센터.
 * 스크롤을 내리면 글자를 접고 전화 아이콘만 남기고(접근성 이름은 항상 "상담 문의"),
 * 멈춘 지 1.2초 뒤 또는 위로 스크롤하면 다시 펼친다. 동작 줄이기면 전환 없이 바로 바뀐다.
 * topButton이면 스크롤 300px 이상에서 "맨 위로" 원형 버튼을 옆에 둔다(상세 화면).
 */
export function FloatingInquiry({ position, topButton = false }: { position: keyof typeof POSITION; topButton?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapsedRef = useRef(false);
  useEffect(() => { collapsedRef.current = collapsed; }, [collapsed]);

  useEffect(() => {
    let last = window.scrollY;
    const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const onScroll = () => {
      const y = window.scrollY;
      setShowTop(y > TOP_AFTER);
      const delta = y - last;
      last = y;
      if (delta > COLLAPSE_DELTA && y > 40) {
        setCollapsed(true);
        clear();
        timer.current = setTimeout(() => setCollapsed(false), EXPAND_AFTER_MS);
      } else if (delta < -COLLAPSE_DELTA) {
        clear();
        setCollapsed(false);
      } else if (collapsedRef.current) {
        // 거의 멈춘 상태의 작은 움직임: 접힘 유지, 타이머만 다시 건다
        clear();
        timer.current = setTimeout(() => setCollapsed(false), EXPAND_AFTER_MS);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clear(); };
  }, []);

  return (
    <div className={cn("pointer-events-none fixed inset-x-0 z-30", POSITION[position])}>
      <div className="mx-auto flex max-w-[480px] items-center justify-end gap-2 px-4">
        <Link
          href="/market/mypage/support"
          aria-label="상담 문의"
          data-collapsed={collapsed}
          className="pressable pointer-events-auto flex h-12 items-center rounded-full bg-ink px-3.5 text-label font-bold text-surface shadow-lg"
        >
          <Phone aria-hidden className="size-5 shrink-0" />
          <span
            aria-hidden
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none",
              collapsed ? "ml-0 max-w-0 opacity-0" : "ml-2 mr-1.5 max-w-24 opacity-100",
            )}
          >
            상담 문의
          </span>
        </Link>
        {topButton && showTop && (
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

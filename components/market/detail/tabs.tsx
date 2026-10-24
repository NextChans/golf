"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { scrollToSection } from "./scroll-link";

export const DETAIL_TABS = [
  { id: "sec-price", label: "시세" },
  { id: "sec-membership", label: "회원권 정보" },
  { id: "sec-usage", label: "이용 정보" },
  { id: "sec-course", label: "골프장 정보" },
] as const;

/**
 * 고정 탭 4개. 상단 바(56px) 아래에 sticky, 가로 스크롤 가능.
 * `<a href="#id">`라 JS 없이도 이동하고, IntersectionObserver로 스크롤 위치에 맞춰 활성 탭(aria-current)을 갱신한다.
 */
export function DetailTabs() {
  const [active, setActive] = useState<string>(DETAIL_TABS[0].id);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const visible = new Set<string>();
    // 고정 영역(상단 바 56 + 탭 48 = 104px) 아래 ~ 화면 위쪽 40% 안에 들어온 섹션을 현재 섹션으로 본다
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const current = [...DETAIL_TABS].reverse().find((t) => visible.has(t.id));
        if (current) setActive(current.id);
      },
      { rootMargin: "-104px 0px -60% 0px" },
    );
    for (const t of DETAIL_TABS) {
      const el = document.getElementById(t.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // 활성 탭이 가로 스크롤 밖이면 안으로 가져온다(페이지 스크롤은 건드리지 않는다)
  useEffect(() => {
    const box = nav.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !el) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [active]);

  return (
    <nav ref={nav} aria-label="상세 정보 탭" className="no-scrollbar sticky top-14 z-30 flex overflow-x-auto border-b border-line bg-surface">
      {DETAIL_TABS.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          aria-current={active === t.id ? "true" : undefined}
          onClick={(e) => {
            setActive(t.id);
            if (scrollToSection(t.id)) e.preventDefault();
          }}
          className={cn(
            "flex min-h-12 shrink-0 items-center border-b-2 px-4 text-subhead font-bold whitespace-nowrap",
            active === t.id ? "border-ink text-ink" : "border-transparent text-ink-mute",
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

"use client";

import type { ReactNode } from "react";

/** prefers-reduced-motion이면 즉시, 아니면 부드럽게 해당 id 섹션으로 스크롤(섹션의 scroll-margin-top이 고정 영역을 보정) */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  return true;
}

/** JS 없이도 `#id` 앵커로 동작하는 링크 */
export function ScrollLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => { if (scrollToSection(to)) e.preventDefault(); }}
    >
      {children}
    </a>
  );
}

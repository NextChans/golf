"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowDownWideNarrow, Check } from "lucide-react";
import type { Route } from "next";
import { SORT_OPTIONS, type SortKey } from "@/lib/domain/market/group";
import { cn } from "@/lib/utils";

/**
 * 정렬 아이콘 버튼 + 바텀시트(role="dialog"). 선택지는 링크라 `?sort=`로 서버가 다시 정렬한다.
 * 열면 현재 선택으로 포커스, Esc·딤 클릭·선택 시 닫고 버튼으로 포커스를 돌려준다.
 * 헤더(sticky, z-30)의 쌓임 맥락 밖에서 가려지지 않도록 body로 포털한다. hrefs는 서버가 현재 조건 쿼리에 sort만 바꿔 만든 경로(sort 기본값은 쿼리에서 뺀다).
 */
export function SortSheet({ current, hrefs }: { current: SortKey; hrefs: Record<SortKey, Route> }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("[aria-current=true]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); return; }
      if (e.key === "Tab" && sheet.current) {
        const f = [...sheet.current.querySelectorAll<HTMLElement>("a,button")];
        const first = f[0]; const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="정렬"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="pressable flex size-11 items-center justify-center text-ink-sub"
      >
        <ArrowDownWideNarrow className="size-6" aria-hidden />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 font-app">
          <button type="button" aria-label="정렬 닫기" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 size-full bg-scrim" />
          <div className="absolute inset-x-0 bottom-0">
            <div
              ref={sheet}
              role="dialog"
              aria-modal="true"
              aria-label="정렬"
              className="mx-auto max-w-[480px] rounded-t-sheet bg-surface px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink"
            >
              <h2 className="text-subhead font-bold">정렬</h2>
              <ul className="mt-2">
                {SORT_OPTIONS.map((o) => {
                  const on = o.id === current;
                  return (
                    <li key={o.id}>
                      <Link
                        href={hrefs[o.id]}
                        replace
                        aria-current={on ? "true" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn("pressable flex h-14 items-center justify-between text-label", on ? "font-bold text-brand-ink" : "font-semibold text-ink-sub")}
                      >
                        {o.label}
                        {on && <Check aria-hidden className="size-5" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

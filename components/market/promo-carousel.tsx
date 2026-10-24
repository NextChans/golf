"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ClipboardList, Gift, ShieldCheck, Tag, type LucideIcon } from "lucide-react";

type Slide = { id: string; lead: string; title: string; href: string; Icon: LucideIcon };

const SLIDES: Slide[] = [
  { id: "coupon", lead: "Googolf 가입하고", title: "첫 거래 수수료 할인\n쿠폰 받기", href: "/market/login", Icon: Gift },
  { id: "report", lead: "주간 시세 리포트", title: "먼저\n받아보기", href: "/market/report", Icon: ClipboardList },
  { id: "verified", lead: "골프장 확인을 거친", title: "매물만\n보여드려요", href: "/market/guide/guarantee", Icon: ShieldCheck },
  { id: "ask", lead: "판매 희망가를 등록하면", title: "담당자가 먼저\n연락드려요", href: "/market/mypage/asks/new", Icon: Tag },
];

/** 하늘색 프로모 배너: 가로 스와이프(scroll-snap), 우상단 "n/4" 표시 */
export function PromoCarousel() {
  const ref = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);
  return (
    <section aria-label="Googolf 소식" className="relative -mx-6 mt-12 bg-info-soft">
      <ul
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setPage(Math.min(SLIDES.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {SLIDES.map(({ id, lead, title, href, Icon }) => (
          <li key={id} className="w-full shrink-0 snap-start">
            <Link href={href as Route} className="pressable flex min-h-[140px] items-center justify-between gap-4 px-6 py-8">
              <span className="min-w-0">
                <span className="block text-caption font-semibold text-ink-sub">{lead}</span>
                <span className="mt-1 block whitespace-pre-line text-heading font-bold text-ink">{title}</span>
              </span>
              <Icon className="size-16 shrink-0 text-info" strokeWidth={1.4} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <span
        role="img"
        aria-label={`배너 ${SLIDES.length}개 중 ${page + 1}번째`}
        className="pointer-events-none absolute top-3 right-4 rounded-full bg-ink-mute/70 px-2.5 py-0.5 text-caption font-bold text-white tabular-nums"
      >
        {page + 1}/{SLIDES.length}
      </span>
    </section>
  );
}

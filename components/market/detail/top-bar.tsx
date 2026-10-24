"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "../favorites";
import { shareOrCopy } from "../share";

/** 사진 높이(300) − 상단 바(56). 이만큼 내려가면 바가 흰 배경으로 바뀐다 */
const SOLID_AFTER = 244;

/**
 * 상세 상단 바. 높이 0짜리 sticky 래퍼 안에 절대 배치해 사진 위에 겹치고, 스크롤하면 화면 맨 위에 흰 배경으로 고정된다.
 * 공유: navigator.share → 없으면 주소 복사. 결과는 role="status"로 알린다(개인정보·추적 없음).
 */
export function DetailTopBar({ id, name }: { id: string; name: string }) {
  const [solid, setSolid] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > SOLID_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function share() {
    const result = await shareOrCopy({ title: `${name} · Googolf 회원권`, url: window.location.href });
    const text = result === "copied" ? "링크를 복사했어요" : result === "failed" ? "공유하지 못했어요. 주소창의 링크를 공유해 주세요" : "";
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    if (text) timer.current = setTimeout(() => setMessage(""), 3000);
  }

  const backing = solid ? "" : "bg-surface/90 shadow-sm";
  return (
    <div className="sticky top-0 z-40 h-0">
      <div className={cn("absolute inset-x-0 top-0 transition-colors", solid && "border-b border-line bg-surface")}>
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-3">
          <Link href="/market" aria-label="뒤로" className={cn("pressable flex size-11 items-center justify-center rounded-full text-ink", backing)}>
            <ChevronLeft className="size-7" aria-hidden />
          </Link>
          <div className={cn("flex items-center rounded-full", backing)}>
            <button type="button" onClick={share} aria-label="공유" className="pressable flex size-11 items-center justify-center text-ink">
              <Share2 className="size-6" aria-hidden />
            </button>
            <FavoriteButton id={id} name={name} />
          </div>
        </div>
        <div className="mx-auto max-w-[480px] px-4">
          <p
            role="status"
            className={message ? "ml-auto w-fit rounded-full bg-ink px-4 py-2 text-caption font-semibold text-surface" : "sr-only"}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ticket, Zap } from "lucide-react";
import { formatManWon, isDismissedToday, kstDateKey } from "@/lib/domain/market/schema";
import { FEE_NOTICE, FEE_POLICY } from "@/lib/mock/market";
import { readJson, STORAGE_KEYS, writeJson } from "./storage";

/**
 * 홈 진입 팝업 2종(D-80): 위에 공지 모달("오늘 그만 보기"), 아래에 혜택 바텀시트("다시 보지 않기").
 * 공지를 닫으면 바텀시트가 드러난다. 숨김 여부는 첫 렌더 뒤 저장소에서 읽는다(서버 렌더에는 팝업 없음).
 */
/** "닫기"는 이 탭(세션) 동안만 숨긴다. 탭 전환·뒤로가기 때 다시 뜨지 않게 sessionStorage에 둔다 */
const SESSION_KEY = "googolf.market.popupsClosed";
function readSession(): { notice?: boolean; coupon?: boolean } {
  try { return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "{}"); } catch { return {}; }
}
function closeForSession(which: "notice" | "coupon") {
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...readSession(), [which]: true })); } catch { /* 무시 */ }
}

export function HomePopups() {
  const [notice, setNotice] = useState(false);
  const [coupon, setCoupon] = useState(false);
  const noticeClose = useRef<HTMLButtonElement>(null);
  const couponClose = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 저장소(외부 시스템)에서 숨김 여부를 읽어 첫 렌더 뒤에 한 번 연다
    const closed = readSession();
    setNotice(!closed.notice && !isDismissedToday(readJson<string | null>(STORAGE_KEYS.noticeHiddenOn, null), new Date()));
    setCoupon(!closed.coupon && !readJson<boolean>(STORAGE_KEYS.couponSheetHidden, false));
  }, []);

  useEffect(() => {
    if (notice) noticeClose.current?.focus();
    else if (coupon) couponClose.current?.focus();
  }, [notice, coupon]);

  useEffect(() => {
    if (!notice && !coupon) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (notice) closeNotice();
      else closeCoupon();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notice, coupon]);

  const closeNotice = () => { closeForSession("notice"); setNotice(false); };
  const closeCoupon = () => { closeForSession("coupon"); setCoupon(false); };

  if (!notice && !coupon) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-scrim" onClick={closeCoupon} />

      {coupon && (
        <div
          role="dialog" aria-modal={!notice} aria-labelledby="coupon-title"
          aria-hidden={notice || undefined}
          className="sheet-up absolute inset-x-0 bottom-0 mx-auto max-w-[480px] overflow-hidden rounded-t-sheet"
        >
          <div className="relative bg-[#1a1b1e] px-7 pt-8 pb-10 text-white">
            <span className="inline-block rounded-md bg-white px-2 py-0.5 text-caption font-bold text-[#1a1b1e]">지금 거래하면</span>
            <h2 id="coupon-title" className="mt-3 text-display font-bold leading-tight">
              수수료 최대
              <br />
              <span className="text-[#4ee59a]">20%</span> 할인!
            </h2>
            <Link
              href="/market/mypage/coupons"
              onClick={closeCoupon}
              className="pressable mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-label font-bold"
            >
              쿠폰 받기 <span aria-hidden>›</span>
            </Link>
            {/* 쿠폰 그림: 이미지 대신 CSS 티켓 */}
            <div aria-hidden className="absolute right-5 bottom-10 w-[46%] -rotate-6 rounded-xl bg-gradient-to-br from-[#4ee59a] to-[#249a62] px-4 py-5 text-center shadow-xl">
              <span className="inline-flex items-center gap-0.5 rounded bg-[#ffd43b] px-1.5 text-tiny font-bold text-[#1a1b1e]"><Zap className="size-3" />선착순</span>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-caption font-semibold text-[#0d2b1c]"><Ticket className="size-4" />수수료 할인 쿠폰</p>
            </div>
          </div>
          <div className="flex h-16 items-center justify-between bg-surface px-8 pb-safe text-label font-semibold text-ink-sub">
            <button type="button" className="pressable h-11" onClick={() => { writeJson(STORAGE_KEYS.couponSheetHidden, true); setCoupon(false); }}>
              다시 보지 않기
            </button>
            <button ref={couponClose} type="button" className="pressable h-11" onClick={closeCoupon}>닫기</button>
          </div>
        </div>
      )}

      {notice && <div aria-hidden className="absolute inset-0 bg-scrim" onClick={closeNotice} />}
      {notice && (
        <div role="dialog" aria-modal="true" aria-labelledby="notice-title" className="pop-in absolute inset-x-6 top-1/2 mx-auto max-h-[calc(100dvh-2rem)] max-w-[400px] -translate-y-1/2 overflow-y-auto">
          <div className="overflow-hidden rounded-sheet">
            <div className="bg-[#1e2838] px-6 pt-7 pb-6 text-center text-white">
              <span className="inline-block rounded-full bg-brand px-3 py-1 text-caption font-bold">안내</span>
              <h2 id="notice-title" className="mt-3 text-subhead font-bold">{FEE_NOTICE.title}</h2>
              <p className="mt-2 text-caption text-white/80">{FEE_NOTICE.body}</p>
              <dl className="mt-5 space-y-1 rounded-card bg-white/10 px-5 py-4 text-left text-caption">
                <dt className="mb-1.5 font-bold">변경 내용</dt>
                <dd>{formatManWon(FEE_POLICY.threshold)} 이하 : <b>{formatManWon(FEE_POLICY.flat)} (주중 {formatManWon(FEE_POLICY.flatWeekday)})</b></dd>
                <dd>{formatManWon(FEE_POLICY.threshold)} 초과 : <b>거래금액의 {(FEE_POLICY.rateBp / 100).toFixed(1)}%</b></dd>
              </dl>
              <p className="mt-4 text-caption font-bold">시행일 : {FEE_NOTICE.effectiveDate.replace(/^(\d+)-(\d+)-(\d+)$/, (_, y, m, d) => `${y}년 ${+m}월 ${+d}일`)}</p>
            </div>
            <div className="bg-surface px-6 pt-5 pb-5">
              <p className="text-subhead font-bold text-ink">{FEE_NOTICE.termsTitle}</p>
              <p className="mt-1 line-clamp-2 text-caption font-medium text-ink-sub">{FEE_NOTICE.termsSummary}</p>
              <Link href="/market/notices/fee" onClick={closeNotice} className="pressable mt-4 flex h-12 items-center justify-center rounded-control bg-fill text-label font-semibold text-ink-sub">
                자세히 보러 가기
              </Link>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center text-label font-semibold text-white">
            <button
              type="button" className="pressable h-11"
              onClick={() => { writeJson(STORAGE_KEYS.noticeHiddenOn, kstDateKey(new Date())); setNotice(false); }}
            >
              오늘 그만 보기
            </button>
            <span aria-hidden className="h-5 w-px bg-white/50" />
            <button ref={noticeClose} type="button" className="pressable h-11" onClick={closeNotice}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

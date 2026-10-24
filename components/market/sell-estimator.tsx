"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  brokerageFee, currentPrice, formatManWon, formatRate, MARKET_REGION_LABEL, matchesQuery, weeklyChangeRate,
} from "@/lib/domain/market/schema";
import { FEE_POLICY, MARKET_ITEMS } from "@/lib/mock/market";
import { primaryButtonClass, rateClass } from "./ui";

const PLACEHOLDERS = MARKET_ITEMS.slice(0, 5).map((i) => i.courseName.replace(/(CC|GC)$/, ""));

/**
 * 판매 탭 "내 회원권, 지금 팔면 얼마일까?": 골프장명을 입력하면 후보를 보여 주고,
 * 고르면 즉시 판매가(최고 구매 입찰)·이번 주 시세·예상 수수료·예상 수령액을 보여 준다(목업 계산).
 */
export function SellEstimator() {
  const listId = useId();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [ph, setPh] = useState(0);

  useEffect(() => {
    if (q || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setPh((v) => (v + 1) % PLACEHOLDERS.length), 2500);
    return () => window.clearInterval(t);
  }, [q]);

  const candidates = useMemo(() => (q.trim() ? MARKET_ITEMS.filter((i) => matchesQuery(i, q)).slice(0, 6) : []), [q]);
  const item = selected ? MARKET_ITEMS.find((i) => i.id === selected) ?? null : null;

  if (item) {
    const quote = currentPrice(item);
    const sellAt = item.bidPrice ?? quote;
    const fee = brokerageFee(sellAt, item.kind, FEE_POLICY);
    const rate = weeklyChangeRate(item.weekly);
    return (
      <section aria-label="예상 판매가" className="enter-fade mt-6 rounded-card border border-line p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-subhead font-bold text-ink">{item.courseName}</p>
            <p className="text-caption text-ink-mute">{MARKET_REGION_LABEL[item.region]} · {item.kind}</p>
          </div>
          <button type="button" onClick={() => { setSelected(null); setQ(""); }} className="pressable text-caption font-semibold text-ink-mute underline underline-offset-4">
            다시 찾기
          </button>
        </div>
        <p className="mt-5 text-caption font-semibold text-ink-sub">지금 팔면</p>
        <p className="text-display font-extrabold text-ink tabular-nums">{formatManWon(sellAt)}</p>
        <dl className="mt-4 space-y-2 text-label">
          <div className="flex justify-between"><dt className="text-ink-mute">이번 주 시세</dt><dd className="font-semibold tabular-nums">{formatManWon(quote)} <span className={rateClass(rate)}>{formatRate(rate)}</span></dd></div>
          <div className="flex justify-between"><dt className="text-ink-mute">예상 수수료</dt><dd className="font-semibold tabular-nums">{formatManWon(fee)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold text-ink-sub">예상 수령액</dt><dd className="font-bold text-brand-ink tabular-nums">{formatManWon(sellAt - fee)}</dd></div>
        </dl>
        <p className="mt-3 text-tiny text-ink-mute">즉시 판매가는 현재 가장 높은 구매 희망가입니다. 명의개서 비용·세금은 포함하지 않았습니다.</p>
        <Link href={`/market/mypage/asks/new?item=${item.id}`} className={`${primaryButtonClass} mt-6 w-full`}>판매 희망가 등록</Link>
      </section>
    );
  }

  return (
    <div className="relative mt-6">
      <label htmlFor="sell-q" className="sr-only">보유 회원권 골프장명</label>
      <div className="flex h-[76px] items-center gap-3 rounded-card border-[1.5px] border-ink bg-surface px-5 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)] focus-within:border-brand">
        <Search className="size-7 shrink-0 text-ink-mute" aria-hidden />
        <input
          id="sell-q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          role="combobox" aria-expanded={candidates.length > 0} aria-controls={listId} aria-autocomplete="list"
          placeholder={PLACEHOLDERS[ph]}
          className="min-w-0 flex-1 bg-transparent text-heading font-bold text-ink outline-none placeholder:text-ink-faint"
        />
        {q && (
          <button type="button" aria-label="검색어 지우기" onClick={() => setQ("")} className="pressable flex size-8 items-center justify-center rounded-full bg-fill">
            <X className="size-4 text-ink-mute" aria-hidden />
          </button>
        )}
      </div>
      {q.trim() !== "" && (
        <ul id={listId} role="listbox" aria-label="골프장 후보" className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
          {candidates.length ? candidates.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button type="button" onClick={() => setSelected(c.id)} className="pressable flex w-full items-center justify-between px-5 py-4 text-left">
                <span>
                  <span className="block text-label font-bold text-ink">{c.courseName}</span>
                  <span className="text-caption text-ink-mute">{MARKET_REGION_LABEL[c.region]} · {c.kind}</span>
                </span>
                <span className="text-caption font-semibold text-ink-sub tabular-nums">{formatManWon(currentPrice(c))}</span>
              </button>
            </li>
          )) : (
            <li className="px-5 py-6 text-center text-caption text-ink-mute">
              찾는 골프장이 없어요. <Link href="/market/mypage/support" className="font-semibold text-brand-ink underline underline-offset-4">상담으로 문의하기</Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

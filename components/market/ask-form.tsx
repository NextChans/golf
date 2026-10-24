"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { brokerageFee, currentPrice, formatManWon } from "@/lib/domain/market/schema";
import { FEE_POLICY, MARKET_ITEMS } from "@/lib/mock/market";
import { primaryButtonClass } from "./ui";

const MAN = 10_000;
const toMan = (s: string) => {
  const n = Number(s.replace(/[^0-9]/g, ""));
  return Number.isSafeInteger(n) ? n : 0;
};

/**
 * 판매 희망가 등록(미리보기). 서버로 보내지 않는다 — 실데이터 연결 때 매도 상담(create_deal_inquiry)으로 바꾼다.
 * 지금 실제 접수는 /memberships/sell에서 한다.
 */
export function AskForm({ initialItem }: { initialItem: string | null }) {
  const [itemId, setItemId] = useState(initialItem ?? "");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const item = MARKET_ITEMS.find((i) => i.id === itemId) ?? null;
  const won = toMan(price) * MAN;
  const fee = item && won ? brokerageFee(won, item.kind, FEE_POLICY) : 0;

  if (done && item) {
    return (
      <div role="status" className="enter-fade flex flex-col items-center px-2 py-12 text-center">
        <CircleCheck className="size-14 text-brand" aria-hidden />
        <p className="mt-4 text-heading font-bold text-ink">판매 희망가를 등록했어요</p>
        <p className="mt-2 text-caption text-ink-mute">{item.courseName} {formatManWon(won)}. 담당자가 회원권 정보를 확인한 뒤 매물로 공개합니다.</p>
        <p className="mt-6 rounded-card bg-fill px-4 py-3 text-caption text-ink-sub">
          미리보기 화면이라 실제로 접수되지 않았습니다. 실제 매도 상담은{" "}
          <Link href="/memberships/sell" className="font-bold text-brand-ink underline underline-offset-4">매도 상담 신청</Link>에서 할 수 있어요.
        </p>
        <Link href="/market/mypage/asks" className={`${primaryButtonClass} mt-8 w-full`}>판매 희망가 보기</Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!item) return setError("회원권을 선택해 주세요.");
        if (toMan(price) < 100) return setError("희망가는 100만원 이상으로 입력해 주세요.");
        if (toMan(price) > 5_000_000) return setError("희망가를 다시 확인해 주세요.");
        setError(null);
        setDone(true);
      }}
      className="space-y-6"
    >
      <div>
        <label htmlFor="ask-item" className="text-label font-bold text-ink-sub">보유 회원권</label>
        <select
          id="ask-item" value={itemId} onChange={(e) => setItemId(e.target.value)}
          className="mt-2 h-14 w-full rounded-control border border-line bg-surface px-4 text-label font-semibold text-ink outline-none focus:border-brand"
        >
          <option value="">골프장을 선택하세요</option>
          {MARKET_ITEMS.map((i) => <option key={i.id} value={i.id}>{i.courseName} · {i.kind}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ask-price" className="text-label font-bold text-ink-sub">판매 희망가</label>
        <div className="mt-2 flex h-14 items-center rounded-control border border-line px-4 focus-within:border-brand">
          <input
            id="ask-price" inputMode="numeric" value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9,]/g, ""))}
            placeholder={item ? String(Math.round(currentPrice(item) / MAN)) : "예: 7500"}
            aria-describedby="ask-help"
            className="min-w-0 flex-1 bg-transparent text-subhead font-bold text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="text-label font-semibold text-ink-mute">만원</span>
        </div>
        <p id="ask-help" className="mt-2 text-caption text-ink-mute">
          {item ? `이번 주 시세 ${formatManWon(currentPrice(item))}` : "회원권을 고르면 이번 주 시세를 보여 드려요."}
          {won > 0 && item && ` · 예상 수수료 ${formatManWon(fee)} · 예상 수령액 ${formatManWon(won - fee)}`}
        </p>
      </div>
      {error && <p role="alert" className="text-caption font-semibold text-up">{error}</p>}
      <button type="submit" className={`${primaryButtonClass} w-full`}>등록하기</button>
    </form>
  );
}

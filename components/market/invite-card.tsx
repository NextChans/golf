"use client";

import { useState } from "react";

type Status = "idle" | "shared" | "copied" | "failed";

/** 친구 초대 카드. 공유 링크는 공개 주소(/market)뿐이다 — 개인 추천 코드·추적 파라미터 없음 */
export function InviteCard() {
  const [status, setStatus] = useState<Status>("idle");

  async function send() {
    const url = `${window.location.origin}/market`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Googolf 회원권", url });
        setStatus("shared");
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch (e) {
      // 사용자가 공유창을 닫은 경우는 오류가 아니다
      if (e instanceof DOMException && e.name === "AbortError") return;
      setStatus("failed");
    }
  }

  return (
    <section
      aria-labelledby="invite-title"
      className="relative mt-12 overflow-hidden rounded-sheet bg-[#14181c] p-6 text-white"
    >
      <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-[radial-gradient(closest-side,#1f9d78,transparent)] opacity-70" />
      <div className="relative">
        <span className="inline-block rounded-full bg-[#14594a] px-3 py-1 text-caption font-bold text-[#5eead4]">친구 초대</span>
        <h2 id="invite-title" className="mt-4 text-heading font-extrabold">
          친구를 초대하면
          <br />
          <span className="text-[#5eead4]">거래 수수료 할인 혜택</span>
        </h2>
        <p className="mt-3 text-caption text-white/80">초대한 친구가 거래를 완료하면 나와 친구 모두 수수료 할인을 받아요.(미리보기)</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[["나의 혜택", "수수료 할인"], ["친구 혜택", "수수료 할인"]].map(([k, v]) => (
            <div key={k} className="rounded-card border border-white/15 bg-white/10 px-3 py-4 text-center">
              <p className="text-caption text-white/75">{k}</p>
              <p className="mt-1 text-label font-extrabold text-[#5eead4]">{v}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={send}
          className="pressable mt-5 flex h-14 w-full items-center justify-center rounded-control bg-white text-subhead font-bold text-[#14181c]"
        >
          초대 링크 보내기
        </button>
        <p role="status" className="mt-3 min-h-5 text-center text-caption text-white/85">
          {status === "copied" && "링크를 복사했어요"}
          {status === "failed" && "복사하지 못했어요. 주소창의 링크를 공유해 주세요"}
        </p>
      </div>
    </section>
  );
}

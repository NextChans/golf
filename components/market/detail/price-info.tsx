"use client";

import { useId, useState } from "react";
import { CircleHelp } from "lucide-react";

/** "현재 시세 ⓘ" — 누르면 설명을 펼친다 */
export function PriceInfo() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="pressable -my-2 flex min-h-11 items-center gap-1.5 text-label font-semibold text-ink-sub"
      >
        현재 시세
        <CircleHelp aria-hidden className="size-5 text-ink-mute" />
        <span className="sr-only">설명 {open ? "닫기" : "보기"}</span>
      </button>
      <p id={id} hidden={!open} className="mb-2 rounded-control bg-surface px-3 py-2 text-caption text-ink-sub">
        주간 조사 기준 평균 시세예요. 실제 거래가는 매물 상태와 협의에 따라 달라질 수 있어요.
      </p>
    </div>
  );
}

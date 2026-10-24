"use client";

import { useState } from "react";
import { Check, ClipboardCheck, UserPlus } from "lucide-react";
import type { MarketDetail } from "@/lib/mock/market-detail";
import { cn } from "@/lib/utils";

type Who = "personal" | "corporate";

/** 회원권 구성(개인/법인 토글) → 입회 필수 체크리스트 → 누구와 함께 이용할 수 있나요? */
export function Admission({ courseName, kind, admission, companion }: {
  courseName: string; kind: string; admission: MarketDetail["admission"]; companion: MarketDetail["companion"];
}) {
  const [who, setWho] = useState<Who>("personal");
  const rows = admission[who];
  return (
    <div>
      <h2 className="text-heading font-extrabold text-ink">회원권 구성</h2>
      <p className="mt-1 text-label font-semibold text-ink-mute">{courseName} · {kind}</p>
      <div role="group" aria-label="입회 구분" className="mt-4 grid grid-cols-2 gap-1 rounded-control bg-fill p-1">
        {([["personal", "개인"], ["corporate", "법인"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={who === id}
            onClick={() => setWho(id)}
            className={cn("pressable min-h-11 rounded-control text-label font-bold", who === id ? "bg-surface text-ink shadow-sm" : "text-ink-mute")}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 className="mt-7 flex items-center gap-2 text-subhead font-bold text-ink">
        <ClipboardCheck aria-hidden className="size-6 text-info" />
        입회 필수 체크 리스트
      </h3>
      <div className="mt-3 rounded-card bg-info-soft p-4">
        <p className="px-1 pb-3 text-subhead font-bold text-ink">{kind}</p>
        <ul className="space-y-2" data-testid="admission-list">
          {rows.map((r) => (
            <li key={r.label} className="flex min-h-14 items-center justify-between gap-3 rounded-control bg-surface px-4 py-3">
              <span className="flex items-center gap-2 text-label font-semibold text-ink-mute">
                <Check aria-hidden className="size-4 text-info" />
                {r.label}
              </span>
              <span className="text-right text-label font-bold text-ink">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-caption text-ink-mute">입회 조건은 골프장 규정에 따라 달라질 수 있어요. 상담 때 최신 내용을 확인해 드려요.(예시 데이터)</p>

      <h3 className="mt-7 flex items-center gap-2 text-subhead font-bold text-ink">
        <UserPlus aria-hidden className="size-6 text-info" />
        누구와 함께 이용할 수 있나요?
      </h3>
      <div className="mt-3 rounded-card bg-info-soft p-4">
        <p className="px-1 pb-3 text-subhead font-bold text-ink">{companion.headline}</p>
        <ul className="space-y-2">
          {companion.rows.map((r) => (
            <li key={r} className="rounded-control bg-surface px-4 py-4 text-label font-bold text-ink">{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

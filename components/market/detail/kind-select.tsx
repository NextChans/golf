"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { MembershipKind } from "@/lib/domain/market/schema";
import { cn } from "@/lib/utils";

/** "회원권 종류" 선택. 같은 골프장의 다른 유형이 있으면 select로 이동, 없으면 비활성 표시 */
export function KindSelect({ currentId, options }: { currentId: string; options: { id: string; kind: MembershipKind }[] }) {
  const router = useRouter();
  const disabled = options.length < 2;
  return (
    <label className={cn("relative flex min-h-[3.25rem] items-center justify-between rounded-card border border-line bg-surface px-4", disabled && "opacity-70")}>
      <span className="text-label font-semibold text-ink-sub">회원권 종류</span>
      <span className="relative flex items-center">
        <select
          aria-label="회원권 종류"
          value={currentId}
          disabled={disabled}
          onChange={(e) => router.push(`/market/items/${e.target.value}` as never)}
          className="min-h-11 cursor-pointer appearance-none bg-transparent py-2 pr-7 text-right text-label font-bold text-ink outline-offset-4 disabled:cursor-default"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.kind}</option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-0 size-5 text-ink-mute" />
      </span>
    </label>
  );
}

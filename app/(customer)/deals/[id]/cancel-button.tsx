"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelDeal } from "../actions";

/** 고객 상담 취소. 사유는 선택(500자), 확인 대화상자 후 실행한다. */
export function CancelDealButton({ dealId, version }: { dealId: string; version: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex flex-col items-center pt-2">
        <Button
          variant="ghost" className="text-destructive hover:bg-destructive/10 hover:no-underline"
          onClick={() => setOpen(true)}
        >
          상담 취소
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-tile-lg bg-card p-6 md:p-8">
      <div className="relative">
        <textarea
          id="cancelReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3}
          placeholder="다른 매물로 결정, 일정 변경 등"
          className={cn(
            "block min-h-24 w-full resize-y rounded-xl border border-input bg-card px-4 pt-7 pb-3 text-body outline-none transition",
            "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15",
          )}
        />
        <label htmlFor="cancelReason" className="pointer-events-none absolute top-2.5 left-4 text-micro text-muted-foreground">
          취소 사유(선택)
        </label>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>닫기</Button>
        <Button
          variant="destructive" disabled={pending}
          onClick={() => {
            if (!confirm("상담을 취소할까요? 취소 후에는 되돌릴 수 없습니다.")) return;
            setError(null);
            start(async () => {
              const r = await cancelDeal({ dealId, expectedVersion: version, reason: reason.trim() || null });
              if (!r.ok) setError(r.error.message);
              router.refresh();
            });
          }}
        >
          {pending ? "취소 중…" : "취소하기"}
        </Button>
      </div>
      {error && <p role="alert" className="text-center text-small text-destructive">{error}</p>}
    </div>
  );
}

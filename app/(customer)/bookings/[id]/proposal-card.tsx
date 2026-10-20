"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatKst } from "@/lib/format/kst";
import { formatWon, totalGreenFee } from "@/lib/domain/booking/money";
import { formatRemaining, remainingMs } from "@/lib/domain/booking/status";
import { acceptProposal, declineProposal } from "../actions";

type Proposal = { id: string; tee_time: string; green_fee_per_person: number; memo: string | null; expires_at: string };

/** 제안 카드: 서버 시각 기준으로 보정한 남은 시간, 수락·거절(F-03). */
export function ProposalCard({ proposal, requestVersion, players, idempotencyKey, serverNow }: {
  proposal: Proposal; requestVersion: number; players: number; idempotencyKey: string; serverNow: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const clientAtRender = useRef<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    clientAtRender.current = Date.now();
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = now === null || clientAtRender.current === null
    ? null
    : remainingMs(proposal.expires_at, serverNow, clientAtRender.current, now);
  const expired = left !== null && left <= 0;

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error?.message ?? "처리하지 못했습니다.");
      router.refresh();
    });
  };

  return (
    <section className="rounded-tile-lg border-2 border-primary bg-card p-6 md:p-8" aria-label="티타임 제안">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small font-semibold text-primary">티타임 제안이 도착했습니다</p>
        <p
          className="rounded-full bg-section px-3 py-1 text-small tabular-nums empty:hidden"
          aria-live="polite" data-testid="proposal-remaining"
        >
          {left === null ? "" : expired ? "만료됨" : `${formatRemaining(left)} 남음`}
        </p>
      </div>
      <p className="mt-4 text-title font-semibold tracking-tight tabular-nums md:text-headline">{formatKst(proposal.tee_time)}</p>
      <p className="mt-2 text-eyebrow">
        1인 {formatWon(proposal.green_fee_per_person)} · 총 {formatWon(totalGreenFee(proposal.green_fee_per_person, players))}
      </p>
      <dl className="mt-5 space-y-2 text-small">
        {proposal.memo && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-muted-foreground">안내</dt>
            <dd className="min-w-0 whitespace-pre-wrap">{proposal.memo}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-muted-foreground">유효시간</dt>
          <dd>{formatKst(proposal.expires_at)}까지</dd>
        </div>
      </dl>
      {error && <p role="alert" className="mt-4 text-small text-destructive">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          variant="secondary" disabled={pending || expired}
          onClick={() => run(() => declineProposal({ proposalId: proposal.id, expectedVersion: requestVersion, reason: null }))}
        >
          다른 시간 요청
        </Button>
        <Button
          disabled={pending || expired}
          onClick={() => run(() => acceptProposal({ idempotencyKey, proposalId: proposal.id, expectedVersion: requestVersion }))}
        >
          {pending ? "처리 중…" : "이 시간으로 확정"}
        </Button>
      </div>
      {expired && <p className="mt-3 text-micro text-muted-foreground">유효시간이 지났습니다. 담당자가 다시 확인합니다.</p>}
    </section>
  );
}

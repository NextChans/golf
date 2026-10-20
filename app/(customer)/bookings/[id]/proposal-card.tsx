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
    <section className="space-y-3 rounded-xl border-2 border-primary p-4" aria-label="티타임 제안">
      <div className="flex items-center justify-between">
        <p className="font-semibold">티타임 제안이 도착했습니다</p>
        <p className="text-sm tabular-nums" aria-live="polite" data-testid="proposal-remaining">
          {left === null ? "" : expired ? "만료됨" : `${formatRemaining(left)} 남음`}
        </p>
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted-foreground">티타임</dt><dd className="font-semibold">{formatKst(proposal.tee_time)}</dd>
        <dt className="text-muted-foreground">그린피</dt>
        <dd>1인 {formatWon(proposal.green_fee_per_person)} · 총 {formatWon(totalGreenFee(proposal.green_fee_per_person, players))}</dd>
        {proposal.memo && (<><dt className="text-muted-foreground">안내</dt><dd className="whitespace-pre-wrap">{proposal.memo}</dd></>)}
        <dt className="text-muted-foreground">유효시간</dt><dd>{formatKst(proposal.expires_at)}까지</dd>
      </dl>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline" disabled={pending || expired}
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
      {expired && <p className="text-xs text-muted-foreground">유효시간이 지났습니다. 담당자가 다시 확인합니다.</p>}
    </section>
  );
}

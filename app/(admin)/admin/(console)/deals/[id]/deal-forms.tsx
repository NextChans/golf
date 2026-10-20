"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import type { DealStatus } from "@/lib/domain/membership/status";
import { advanceDeal, assignDeal, cancelDealAsAdmin, startDeal, updateDealTerms } from "../actions";

const Hidden = ({ dealId, version }: { dealId: string; version: number }) => (
  <>
    <input type="hidden" name="dealId" value={dealId} />
    <input type="hidden" name="expectedVersion" value={version} />
  </>
);

export function DealProgressButton({ dealId, version, kind, toStatus, label, description, blocker }: {
  dealId: string; version: number; kind: "start" | "advance"; toStatus?: DealStatus;
  label: string; description: string; blocker?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => {
    if (!window.confirm(`${label}할까요?`)) return;
    start(async () => {
      setError(null);
      const r = kind === "start"
        ? await startDeal({ dealId, expectedVersion: version })
        : await advanceDeal({ dealId, expectedVersion: version, toStatus });
      if (!r.ok) setError(r.error.message);
    });
  };
  return (
    <div className="mt-3 space-y-3">
      <p className="text-small text-muted-foreground">{description}</p>
      {blocker && <p className="text-small text-warning">{blocker}</p>}
      {error && <p role="alert" className="text-small text-destructive">{error}</p>}
      <Button className="w-full" disabled={pending || !!blocker} onClick={run}>{pending ? "처리 중…" : label}</Button>
    </div>
  );
}

export function DealTermsForm({ dealId, version, agreedPrice, contractDate }: {
  dealId: string; version: number; agreedPrice: number | null; contractDate: string | null;
}) {
  const [state, action, pending] = useActionState(updateDealTerms, {});
  return (
    <form key={version} action={action} className="space-y-4">
      <Hidden dealId={dealId} version={version} />
      <FloatingInput id="agreedPrice" name="agreedPrice" inputMode="numeric" label="합의가(원)"
        defaultValue={agreedPrice ?? ""} error={state.fieldErrors?.agreedPrice} />
      <FloatingInput id="contractDate" name="contractDate" type="date" label="계약일"
        defaultValue={contractDate ?? ""} error={state.fieldErrors?.contractDate} />
      {state.error && <p role="alert" className="text-small text-destructive">{state.error}</p>}
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>조건 저장</Button>
    </form>
  );
}

type Staff = { id: string; display_name: string; email: string; is_me: boolean };

export function DealAssignForm({ dealId, version, currentAssigneeId, staff }: {
  dealId: string; version: number; currentAssigneeId: string | null; staff: Staff[];
}) {
  const me = staff.find((s) => s.is_me);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? me?.id ?? staff[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (id: string) =>
    start(async () => {
      setError(null);
      const r = await assignDeal({ dealId, assigneeId: id, expectedVersion: version });
      if (!r.ok) setError(r.error.message);
    });
  return (
    <div className="mt-3 space-y-3">
      {me && currentAssigneeId !== me.id && (
        <Button className="w-full" variant="secondary" disabled={pending} onClick={() => submit(me.id)}>나에게 배정</Button>
      )}
      <div className="flex gap-2">
        <label htmlFor="deal-assignee" className="sr-only">담당자 선택</label>
        <select id="deal-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-small">
          {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}{s.is_me ? " (나)" : ""}</option>)}
        </select>
        <Button variant="secondary" disabled={pending || !assigneeId || assigneeId === currentAssigneeId} onClick={() => submit(assigneeId)}>배정</Button>
      </div>
      {error && <p role="alert" className="text-small text-destructive">{error}</p>}
    </div>
  );
}

export function DealCancelForm({ dealId, version, holdsListing }: { dealId: string; version: number; holdsListing: boolean }) {
  const [state, action, pending] = useActionState(cancelDealAsAdmin, {});
  return (
    <form action={action} className="space-y-3"
      onSubmit={(e) => { if (!window.confirm("거래를 취소할까요? 되돌릴 수 없습니다.")) e.preventDefault(); }}>
      <Hidden dealId={dealId} version={version} />
      <h2 className="text-eyebrow tracking-tight">거래 취소</h2>
      <p className="text-small text-muted-foreground">
        {holdsListing ? "취소하면 매물이 다시 공개됩니다. " : ""}고객에게 취소 사유가 표시됩니다.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="deal-cancel-reason" className="px-1 text-small">취소 사유</label>
        <textarea id="deal-cancel-reason" name="reason" rows={2} maxLength={500} required
          className="w-full rounded-xl border border-input bg-card px-4 py-3 text-body outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        {state.fieldErrors?.reason && <p className="px-1 text-small text-destructive">{state.fieldErrors.reason}</p>}
      </div>
      {state.error && <p role="alert" className="text-small text-destructive">{state.error}</p>}
      <Button type="submit" variant="destructive" className="w-full" disabled={pending}>거래 취소</Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { cancelBookingAsAdmin, proposeBooking, rejectBooking, type AdminFormState } from "../actions";

const Hidden = ({ requestId, version }: { requestId: string; version: number }) => (
  <>
    <input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="expectedVersion" value={version} />
  </>
);

const FormError = ({ state }: { state: AdminFormState }) =>
  state.error ? <p role="alert" className="text-small text-destructive">{state.error}</p> : null;

export function ProposeForm({ requestId, version, defaultGreenFee, playDate, hasOffered }: {
  requestId: string; version: number; defaultGreenFee: number | null; playDate: string; hasOffered: boolean;
}) {
  const [state, action, pending] = useActionState(proposeBooking, {});
  return (
    // version이 바뀌면(제안 성공) 폼을 초기화한다
    <form key={version} action={action} className="space-y-4">
      <Hidden requestId={requestId} version={version} />
      <FloatingInput id="teeTime" name="teeTime" type="datetime-local" label="티타임(KST)" required
        defaultValue={`${playDate}T07:00`} error={state.fieldErrors?.teeTime} />
      <FloatingInput id="greenFeePerPerson" name="greenFeePerPerson" inputMode="numeric" label="1인 그린피(원)" required
        defaultValue={defaultGreenFee ?? ""} error={state.fieldErrors?.greenFeePerPerson} />
      <FloatingInput id="validMinutes" name="validMinutes" inputMode="numeric" label="제안 유효시간(분)"
        defaultValue={120} error={state.fieldErrors?.validMinutes} />
      <div className="space-y-1.5">
        <label htmlFor="memo" className="px-1 text-small text-muted-foreground">고객에게 보낼 메모(선택)</label>
        <textarea id="memo" name="memo" rows={2} maxLength={500}
          className="w-full rounded-xl border border-input bg-card px-4 py-3 text-body outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        {state.fieldErrors?.memo && <p className="px-1 text-small text-destructive">{state.fieldErrors.memo}</p>}
      </div>
      <FormError state={state} />
      {hasOffered && <p className="text-micro text-muted-foreground">새로 제안하면 기존 제안은 회수됩니다.</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "제안 중…" : "티타임 제안"}</Button>
    </form>
  );
}

function ReasonForm({ requestId, version, action: serverAction, label, submit, description }: {
  requestId: string; version: number; label: string; submit: string; description: string;
  action: (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;
}) {
  const [state, action, pending] = useActionState(serverAction, {});
  const id = `${submit}-reason`;
  return (
    <form action={action} className="space-y-3"
      onSubmit={(e) => { if (!window.confirm(`${submit}할까요? 되돌릴 수 없습니다.`)) e.preventDefault(); }}>
      <Hidden requestId={requestId} version={version} />
      <p className="text-small text-muted-foreground">{description}</p>
      <div className="space-y-1.5">
        <label htmlFor={id} className="px-1 text-small">{label}</label>
        <textarea id={id} name="reason" rows={2} maxLength={500} required
          className="w-full rounded-xl border border-input bg-card px-4 py-3 text-body outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        {state.fieldErrors?.reason && <p className="px-1 text-small text-destructive">{state.fieldErrors.reason}</p>}
      </div>
      <FormError state={state} />
      <Button type="submit" variant="destructive" className="w-full" disabled={pending}>{submit}</Button>
    </form>
  );
}

export function RejectForm({ requestId, version }: { requestId: string; version: number }) {
  return (
    <ReasonForm requestId={requestId} version={version} action={rejectBooking} label="불가 사유" submit="예약 불가 처리"
      description="고객에게 사유가 표시됩니다." />
  );
}

export function CancelForm({ requestId, version, confirmed }: { requestId: string; version: number; confirmed: boolean }) {
  return (
    <ReasonForm requestId={requestId} version={version} action={cancelBookingAsAdmin} label="취소 사유" submit="예약 취소"
      description={confirmed ? "확정된 예약입니다. 골프장 취소 규정을 확인한 뒤 진행해 주세요." : "고객에게 취소 사유가 표시됩니다."} />
  );
}

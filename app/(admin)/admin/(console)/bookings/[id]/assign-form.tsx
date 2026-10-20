"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assignBooking } from "../actions";

type Staff = { id: string; display_name: string; email: string; is_me: boolean };

export function AssignForm({ requestId, version, currentAssigneeId, staff }: {
  requestId: string; version: number; currentAssigneeId: string | null; staff: Staff[];
}) {
  const me = staff.find((s) => s.is_me);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? me?.id ?? staff[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (id: string) =>
    start(async () => {
      setError(null);
      const r = await assignBooking({ requestId, assigneeId: id, expectedVersion: version });
      if (!r.ok) setError(r.error.message);
    });

  return (
    <div className="mt-3 space-y-3">
      {me && currentAssigneeId !== me.id && (
        <Button className="w-full" disabled={pending} onClick={() => submit(me.id)}>나에게 배정</Button>
      )}
      <div className="flex gap-2">
        <label htmlFor="assignee" className="sr-only">담당자 선택</label>
        <select
          id="assignee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-small"
        >
          {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}{s.is_me ? " (나)" : ""}</option>)}
        </select>
        <Button variant="secondary" disabled={pending || !assigneeId || assigneeId === currentAssigneeId} onClick={() => submit(assigneeId)}>
          배정
        </Button>
      </div>
      {error && <p role="alert" className="text-small text-destructive">{error}</p>}
    </div>
  );
}

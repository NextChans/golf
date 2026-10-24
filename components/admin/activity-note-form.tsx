"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { addNote } from "@/app/(admin)/admin/(console)/customers/actions";
import { NOTE_MAX, type NoteSubjectType } from "@/lib/domain/crm/schema";
import { cn } from "@/lib/utils";

/** 통화 메모 입력(A-06). 고객 상세(customer)와 거래 상세(deal)에서 함께 쓴다. */
export function ActivityNoteForm({ customerId, subjectType, subjectId, className }: {
  customerId: string; subjectType: NoteSubjectType; subjectId?: string; className?: string;
}) {
  const [state, action, pending] = useActionState(addNote, null);
  const formRef = useRef<HTMLFormElement>(null);
  const id = `note-body-${subjectType}`;

  // 성공한 결과마다(새 객체) 입력을 비운다
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className={cn("space-y-3", className)}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="subjectType" value={subjectType} />
      {subjectId && <input type="hidden" name="subjectId" value={subjectId} />}
      <div className="space-y-1.5">
        <label htmlFor={id} className="block px-1 text-small text-muted-foreground">통화 메모</label>
        <textarea
          id={id} name="body" required maxLength={NOTE_MAX} rows={3}
          placeholder="통화 내용, 고객 요청, 다음 연락 예정 등"
          aria-invalid={state && !state.ok ? true : undefined}
          className="w-full rounded-xl border border-input bg-card px-4 py-3 text-body outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive"
        />
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{state.error.message}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "저장 중…" : "메모 남기기"}</Button>
      </div>
    </form>
  );
}

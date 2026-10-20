"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingInput } from "@/components/site/field";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import { REPORT_REASON_LABEL, REPORT_REASONS, type ReportTarget } from "@/lib/domain/community/labels";
import { cancelMeeting, createPost, joinGroup, reportContent, type FormState } from "../actions";
import { Chevron, FieldError, fieldLabelClass, selectClass, textareaClass } from "../fields";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * 서버 액션 버튼(확인창 선택). 성공하면 액션의 revalidatePath가 같은 화면을 다시 그린다(D-62: router.refresh 미사용).
 */
export function RunButton<I>({ action, input, children, pendingLabel, confirmText, variant = "secondary", size = "sm", className, disabled }: {
  action: (input: I) => Promise<ActionResult>; input: I; children: React.ReactNode; pendingLabel?: string;
  confirmText?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string; disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button" variant={variant} size={size} className={className} disabled={pending || disabled}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const r = await action(input);
            if (!r.ok) setError(r.error.message);
          });
        }}
      >
        {pending ? (pendingLabel ?? "처리 중…") : children}
      </Button>
      {error && <span role="alert" className="text-small text-destructive">{error}</span>}
    </span>
  );
}

/** 가입(공개) / 가입 신청(승인제, 인사말 선택) */
export function JoinForm({ groupId, policy }: { groupId: string; policy: "open" | "approval" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinGroup, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      {policy === "approval" && (
        <div className="space-y-1.5">
          <div className="relative">
            <textarea
              id="join-message" name="message" maxLength={200} rows={3} placeholder="간단한 소개, 구력 등"
              aria-invalid={errors.message ? true : undefined} className={cn(textareaClass, "min-h-24")}
            />
            <label htmlFor="join-message" className={fieldLabelClass}>인사말(선택)</label>
          </div>
          <FieldError message={errors.message} />
        </div>
      )}
      {state.error && <p role="alert" className="text-center text-body text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "처리 중…" : policy === "open" ? "가입하기" : "가입 신청"}
      </Button>
    </form>
  );
}

/** 게시글 작성. 공지 체크박스는 모임장·운영진에게만 보인다(DB가 최종 판단) */
export function PostForm({ groupId, canNotice }: { groupId: string; canNotice: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPost, {});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.done) formRef.current?.reset();
  }, [state.done]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3" noValidate aria-label="글쓰기">
      <input type="hidden" name="groupId" value={groupId} />
      <FloatingInput id="post-title" name="title" label="제목" maxLength={80} error={errors.title} />
      <div className="space-y-1.5">
        <div className="relative">
          <textarea
            id="post-body" name="body" maxLength={5000} rows={4} placeholder="연락처·계좌번호는 적지 마세요"
            aria-invalid={errors.body ? true : undefined} className={textareaClass}
          />
          <label htmlFor="post-body" className={fieldLabelClass}>내용</label>
        </div>
        <FieldError message={errors.body} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canNotice ? (
          <label className="flex min-h-11 items-center gap-2 text-body">
            <Checkbox name="isNotice" id="post-notice" />
            공지로 올리기
          </label>
        ) : <span />}
        <Button type="submit" disabled={pending}>{pending ? "올리는 중…" : "글 올리기"}</Button>
      </div>
      {state.error && <p role="alert" className="text-body text-destructive">{state.error}</p>}
    </form>
  );
}

/** 정모 취소(사유 입력) */
export function CancelMeetingButton({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setOpen(true)}>정모 취소</Button>
    );
  }
  return (
    <div className="mt-3 w-full space-y-2 rounded-xl bg-section p-3">
      <FloatingInput id={`${id}-reason`} label="취소 사유(선택)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>닫기</Button>
        <Button
          type="button" size="sm" variant="destructive" disabled={pending}
          onClick={() => {
            if (!confirm("정모를 취소할까요? 참석자에게 알림이 갑니다.")) return;
            setError(null);
            start(async () => {
              const r = await cancelMeeting({ meetingId, reason });
              if (!r.ok) setError(r.error.message);
            });
          }}
        >
          {pending ? "취소 중…" : "정모 취소하기"}
        </Button>
      </div>
      {error && <p role="alert" className="text-small text-destructive">{error}</p>}
    </div>
  );
}

const TARGET_LABEL: Record<ReportTarget, string> = { group: "모임", post: "게시글", user: "멤버" };

/** 신고(사유 + 상세). 같은 대상 중복 신고는 DB가 막는다(duplicate_report) */
export function ReportButton({ targetType, targetId }: { targetType: ReportTarget; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(reportContent, {});
  const id = useId();
  const errors = state.fieldErrors ?? {};

  if (state.done) {
    return <p role="status" className="text-small text-muted-foreground">신고가 접수되었습니다</p>;
  }
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setOpen(true)}>
        신고
      </Button>
    );
  }
  return (
    <form
      action={action} noValidate aria-label={`${TARGET_LABEL[targetType]} 신고`}
      className="mt-2 w-full space-y-2 rounded-xl bg-section p-3"
      onSubmit={(e) => {
        if (!confirm(`이 ${TARGET_LABEL[targetType]}을(를) 신고할까요?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <div className="relative">
        <select id={`${id}-reason`} name="reason" defaultValue="" className={selectClass} aria-invalid={errors.reason ? true : undefined}>
          <option value="" disabled>선택해 주세요</option>
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{REPORT_REASON_LABEL[r]}</option>)}
        </select>
        <label htmlFor={`${id}-reason`} className={fieldLabelClass}>신고 사유</label>
        <Chevron />
      </div>
      <FieldError message={errors.reason} />
      <div className="relative">
        <textarea id={`${id}-detail`} name="detail" maxLength={500} rows={2} className={cn(textareaClass, "min-h-20")} />
        <label htmlFor={`${id}-detail`} className={fieldLabelClass}>내용(선택)</label>
      </div>
      <FieldError message={errors.detail} />
      {state.error && <p role="alert" className="text-small text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>닫기</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "접수 중…" : "신고하기"}</Button>
      </div>
    </form>
  );
}

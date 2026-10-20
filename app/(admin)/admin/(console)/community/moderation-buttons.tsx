"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { groupModerationActions, type GroupStatus } from "@/lib/domain/community/admin-schema";
import { moderateGroup, moderatePost, resolveReport } from "./actions";

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error.message);
    });
  };
  return { error, pending, run };
}

const ErrorText = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="text-micro text-destructive">{error}</p> : null;

/** 신고 처리 완료·기각 */
export function ReportActions({ reportId }: { reportId: number }) {
  const { error, pending, run } = useRun();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={pending}
          onClick={() => run(() => resolveReport({ reportId, status: "dismissed" }), "이 대상의 열린 신고를 모두 기각할까요?")}>
          기각
        </Button>
        <Button size="sm" disabled={pending}
          onClick={() => run(() => resolveReport({ reportId, status: "resolved" }))}>
          {pending ? "처리 중…" : "처리 완료"}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

/** 게시글 숨기기·복구 */
export function PostActions({ postId, hidden }: { postId: string; hidden: boolean }) {
  const { error, pending, run } = useRun();
  return (
    <div className="flex flex-col items-start gap-1">
      {hidden ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => moderatePost({ postId, hidden: false }))}>
          {pending ? "처리 중…" : "게시글 복구"}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" disabled={pending}
          onClick={() => run(() => moderatePost({ postId, hidden: true }), "이 게시글을 숨길까요? 모임 멤버에게 보이지 않습니다.")}>
          {pending ? "처리 중…" : "게시글 숨기기"}
        </Button>
      )}
      <ErrorText error={error} />
    </div>
  );
}

/** 모임 공개 승인·비공개(사유 필수)·복구 */
export function GroupActions({ groupId, status, groupName }: { groupId: string; status: GroupStatus; groupName: string }) {
  const { error, pending, run } = useRun();
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const inputId = useId();
  const can = groupModerationActions(status);
  if (!can.canApprove && !can.canHide && !can.canRestore) return null;

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <div className="flex flex-wrap justify-end gap-2">
        {can.canApprove && (
          <Button size="sm" disabled={pending} onClick={() => run(() => moderateGroup({ groupId, status: "active", reason: "" }))}>
            공개 승인
          </Button>
        )}
        {can.canRestore && (
          <Button size="sm" disabled={pending}
            onClick={() => run(() => moderateGroup({ groupId, status: "active", reason: "" }), `'${groupName}' 모임을 다시 공개할까요?`)}>
            복구
          </Button>
        )}
        {can.canHide && !hiding && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setHiding(true)}>비공개</Button>
        )}
      </div>
      {can.canHide && hiding && (
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await moderateGroup({ groupId, status: "hidden", reason });
            if (r.ok) setHiding(false);
            return r;
          }, `'${groupName}' 모임을 비공개로 돌릴까요? 모임장에게 사유가 안내됩니다.`);
        }}>
          <label htmlFor={inputId} className="block px-1 text-small">비공개 사유</label>
          <textarea id={inputId} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} required
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-body outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setHiding(false)}>닫기</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={pending || reason.trim() === ""}>
              {pending ? "처리 중…" : "비공개 처리"}
            </Button>
          </div>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  );
}

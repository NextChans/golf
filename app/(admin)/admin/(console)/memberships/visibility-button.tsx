"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ListingStatus } from "@/lib/domain/membership/admin-schema";
import { setListingVisibility, type MembershipFormState } from "./actions";

/** 비공개 ↔ 공개 전환 버튼. 상담 중·판매완료 매물에는 그리지 않는다(DB도 거부) */
export function VisibilityButton({ listingId, status, label }: { listingId: string; status: ListingStatus; label?: string }) {
  const [state, action, pending] = useActionState<MembershipFormState, FormData>(setListingVisibility, {});
  const router = useRouter();
  // hydration 전에 누르면 브라우저 기본 제출(전체 페이지 POST)이 일어나 상태가 어긋난다. 준비될 때까지 비활성화한다
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // 성공하면 현재 화면을 새로 받는다(액션은 revalidatePath를 쓰지 않음, actions.ts 주석)
  useEffect(() => {
    if (state.savedAt) router.refresh();
  }, [state.savedAt, router]);
  if (status !== "hidden" && status !== "listed") return null;
  const makeVisible = status === "hidden";
  const text = makeVisible ? "공개하기" : "비공개로 전환";

  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="visible" value={String(makeVisible)} />
      <Button
        type="submit" size="sm" variant={makeVisible ? "default" : "secondary"} disabled={!ready || pending}
        aria-label={label ? `${label} ${text}` : undefined}
      >
        {pending ? "처리 중…" : text}
      </Button>
      {state.error && <p role="alert" className="max-w-48 text-right text-micro text-destructive">{state.error}</p>}
    </form>
  );
}

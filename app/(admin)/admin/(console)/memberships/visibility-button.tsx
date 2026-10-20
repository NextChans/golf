"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ListingStatus } from "@/lib/domain/membership/admin-schema";
import { setListingVisibility, type MembershipFormState } from "./actions";

/** 비공개 ↔ 공개 전환 버튼. 상담 중·판매완료 매물에는 그리지 않는다(DB도 거부) */
export function VisibilityButton({ listingId, status, label }: { listingId: string; status: ListingStatus; label?: string }) {
  const [state, action, pending] = useActionState<MembershipFormState, FormData>(setListingVisibility, {});
  if (status !== "hidden" && status !== "listed") return null;
  const makeVisible = status === "hidden";
  const text = makeVisible ? "공개하기" : "비공개로 전환";

  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="visible" value={String(makeVisible)} />
      <Button
        type="submit" size="sm" variant={makeVisible ? "default" : "secondary"} disabled={pending}
        aria-label={label ? `${label} ${text}` : undefined}
      >
        {pending ? "처리 중…" : text}
      </Button>
      {state.error && <p role="alert" className="max-w-48 text-right text-micro text-destructive">{state.error}</p>}
    </form>
  );
}

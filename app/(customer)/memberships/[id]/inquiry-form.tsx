"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingInput } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { formatKoreanPrice } from "@/lib/domain/membership/schema";
import { createBuyInquiry, type CreateInquiryState } from "../actions";
import { FieldError, fieldLabelClass, formatDigits, textareaClass } from "../fields";

export function InquiryForm({ idempotencyKey, listingId }: { idempotencyKey: string; listingId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateInquiryState, FormData>(createBuyInquiry, {});
  const [price, setPrice] = useState("");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.createdId) router.replace(`/deals/${state.createdId}`);
  }, [state.createdId, router]);

  const done = pending || !!state.createdId;
  const priceNumber = Number(price.replace(/,/g, ""));

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="listingId" value={listingId} />
      <FloatingInput
        id="desiredPrice" name="desiredPrice" label="희망 매수가(선택)" inputMode="numeric" suffix="원"
        value={price} error={errors.desiredPrice}
        onChange={(e) => setPrice(formatDigits(e.target.value))}
      />
      {priceNumber > 0 && !errors.desiredPrice && (
        <p className="-mt-2 px-1 text-small text-muted-foreground tabular-nums">{formatKoreanPrice(priceNumber)}</p>
      )}
      <FloatingInput
        id="contactWindow" name="contactWindow" label="연락 가능 시간(선택)" maxLength={100}
        error={errors.contactWindow}
      />
      <div className="space-y-1.5">
        <div className="relative">
          <textarea
            id="note" name="note" maxLength={1000} rows={4} placeholder="궁금한 점, 희망 거래 시기 등"
            aria-invalid={errors.note ? true : undefined} className={textareaClass}
          />
          <label htmlFor="note" className={fieldLabelClass}>요청사항(선택)</label>
        </div>
        <FieldError message={errors.note} />
      </div>
      <FieldError message={errors.listingId ?? errors.idempotencyKey} />
      <div className="space-y-3 pt-2">
        {state.error && <p role="alert" className="text-center text-body text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={done}>{done ? "신청 중…" : "상담 신청하기"}</Button>
        <p className="text-center text-micro text-muted-foreground">
          신청은 계약이 아니며, 담당자가 전화로 조건을 확인해 드립니다.
        </p>
      </div>
    </form>
  );
}

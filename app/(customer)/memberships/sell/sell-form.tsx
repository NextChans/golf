"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingInput } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { formatKoreanPrice } from "@/lib/domain/membership/schema";
import { createSellInquiry, type CreateInquiryState } from "../actions";
import { Chevron, FieldError, fieldLabelClass, formatDigits, selectClass, textareaClass } from "../fields";

export type ProductGroup = { courseName: string; regionLabel: string; products: { id: string; kind: string }[] };

export function SellForm({ idempotencyKey, groups, initialProduct }: {
  idempotencyKey: string; groups: ProductGroup[]; initialProduct: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateInquiryState, FormData>(createSellInquiry, {});
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
      <div className="space-y-1.5">
        <div className="relative">
          <select
            id="productId" name="productId" defaultValue={initialProduct} className={selectClass}
            aria-invalid={errors.productId ? true : undefined}
          >
            <option value="" disabled>선택해 주세요</option>
            {groups.map((g) => (
              <optgroup key={g.courseName} label={`${g.courseName} (${g.regionLabel})`}>
                {g.products.map((p) => <option key={p.id} value={p.id}>{g.courseName} {p.kind}</option>)}
              </optgroup>
            ))}
          </select>
          <label htmlFor="productId" className={fieldLabelClass}>보유 회원권</label>
          <Chevron />
        </div>
        <FieldError message={errors.productId} />
      </div>
      <FloatingInput
        id="desiredPrice" name="desiredPrice" label="희망 매도가(선택)" inputMode="numeric" suffix="원"
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
            id="note" name="note" maxLength={1000} rows={4} placeholder="희망 거래 시기, 궁금한 점 등(주민번호는 적지 마세요)"
            aria-invalid={errors.note ? true : undefined} className={textareaClass}
          />
          <label htmlFor="note" className={fieldLabelClass}>메모(선택)</label>
        </div>
        <FieldError message={errors.note} />
      </div>
      <div className="space-y-3 pt-6">
        {state.error && <p role="alert" className="text-center text-body text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={done}>{done ? "신청 중…" : "매도 상담 신청하기"}</Button>
        <p className="text-center text-micro text-muted-foreground">
          서류는 상담 후 안내해 드리며, 신분증·인감은 온라인으로 받지 않습니다.
        </p>
      </div>
    </form>
  );
}

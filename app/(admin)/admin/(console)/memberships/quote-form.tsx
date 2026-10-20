"use client";

import { startTransition, useActionState } from "react";
import { FloatingInput } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { saveQuote, type MembershipFormState } from "./actions";
import { FormAlert } from "./form-parts";

/**
 * 시세 입력 폼. 같은 상품·같은 기준일은 덮어쓴다(DB upsert_quote).
 * 검증 실패 시 입력값을 유지하고, 저장에 성공하면 key를 바꿔 빈 폼으로 되돌린다.
 */
export function QuoteForm({ productId, today }: { productId: string; today: string }) {
  const [state, action, pending] = useActionState<MembershipFormState, FormData>(saveQuote, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form
      key={state.savedAt ?? 0}
      noValidate
      aria-label="시세 입력"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <FloatingInput
        id="quote-date" name="quotedOn" type="date" label="기준일" required max={today}
        defaultValue={today} error={errors.quotedOn}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FloatingInput
          id="quote-buy" name="buyPrice" label="매수 시세" inputMode="numeric" autoComplete="off" suffix="원"
          error={errors.buyPrice}
        />
        <FloatingInput
          id="quote-sell" name="sellPrice" label="매도 시세" inputMode="numeric" autoComplete="off" suffix="원"
          error={errors.sellPrice}
        />
      </div>
      <p className="-mt-2 px-1 text-micro text-muted-foreground">둘 중 하나만 입력해도 됩니다. 같은 기준일에 다시 저장하면 덮어씁니다.</p>
      <FormAlert message={state.error} />
      {state.savedAt && !pending && <p role="status" className="px-1 text-small text-primary">시세를 저장했습니다.</p>}
      <div className="flex justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
          {pending ? "저장 중…" : "시세 저장"}
        </Button>
      </div>
    </form>
  );
}

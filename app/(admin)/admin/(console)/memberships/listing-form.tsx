"use client";

import { startTransition, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingInput } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import type { ListingStatus } from "@/lib/domain/membership/admin-schema";
import { cn } from "@/lib/utils";
import { saveListing, type MembershipFormState } from "./actions";
import { amountText, boxClass, FieldError, fieldLabelClass, FormAlert, SelectField } from "./form-parts";

export type ListingFormValues = {
  id: string; product_id: string; asking_price: number; description: string | null; status: ListingStatus;
};
export type ProductOption = { id: string; label: string; is_active: boolean };

/**
 * 매물 생성·수정 폼.
 * - 상담 중(reserved): 상품·호가는 바꿀 수 없다(DB도 거부). 보이는 칸은 disabled로 두고 현재 값은 hidden으로 보낸다.
 * - 판매완료(sold): 전부 읽기 전용, 저장 버튼 없음.
 */
export function ListingForm({ listing, products }: { listing?: ListingFormValues; products: ProductOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MembershipFormState, FormData>(saveListing, {});
  const errors = state.fieldErrors ?? {};
  const sold = listing?.status === "sold";
  const priceLocked = listing?.status === "reserved" || sold;

  useEffect(() => {
    if (!state.savedId) return;
    router.replace(listing ? "/admin/memberships" : `/admin/memberships/listings/${state.savedId}`);
  }, [state.savedId, listing, router]);

  const done = pending || !!state.savedId;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (sold) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="id" value={listing?.id ?? ""} />
      {priceLocked && listing && (
        <>
          <input type="hidden" name="productId" value={listing.product_id} />
          <input type="hidden" name="askingPrice" value={listing.asking_price} />
        </>
      )}
      <SelectField
        id="listing-product" name={priceLocked ? undefined : "productId"} label="상품"
        defaultValue={listing?.product_id ?? ""} error={errors.productId} disabled={priceLocked}
      >
        <option value="" disabled>상품을 선택해 주세요</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.is_active ? p.label : `${p.label} (판매 중지)`}</option>
        ))}
      </SelectField>
      <FloatingInput
        id="listing-price" name={priceLocked ? undefined : "askingPrice"} label="호가" inputMode="numeric" autoComplete="off" suffix="원"
        defaultValue={amountText(listing?.asking_price)} error={errors.askingPrice} disabled={priceLocked}
        className={priceLocked ? "[&_input]:bg-section [&_input]:text-muted-foreground" : undefined}
      />
      {listing?.status === "reserved" && (
        <p className="-mt-2 px-1 text-small text-muted-foreground">
          상담이 진행 중인 매물은 상품과 호가를 바꿀 수 없습니다. 상담이 취소되면 다시 수정할 수 있습니다.
        </p>
      )}
      <div className="space-y-1.5">
        <div className="relative">
          <textarea
            id="listing-description" name="description" maxLength={2000} rows={6} disabled={sold}
            defaultValue={listing?.description ?? ""}
            aria-invalid={errors.description ? true : undefined}
            className={cn(boxClass, "block min-h-36 resize-y px-4 pt-7 pb-3")}
          />
          <label htmlFor="listing-description" className={fieldLabelClass}>설명</label>
        </div>
        <FieldError message={errors.description} />
      </div>
      {sold && <p className="px-1 text-small text-muted-foreground">판매가 끝난 매물은 수정할 수 없습니다.</p>}
      {!listing && <p className="px-1 text-small text-muted-foreground">새 매물은 비공개로 등록됩니다. 내용을 확인한 뒤 공개해 주세요.</p>}
      <FormAlert message={state.error} />
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/admin/memberships">{sold ? "목록으로" : "취소"}</Link>
        </Button>
        {!sold && (
          <Button type="submit" className="w-full sm:w-auto" disabled={done}>
            {done ? "저장 중…" : "저장"}
          </Button>
        )}
      </div>
    </form>
  );
}

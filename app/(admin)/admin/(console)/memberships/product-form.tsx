"use client";

import { startTransition, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingInput } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { saveProduct, type MembershipFormState } from "./actions";
import { FormAlert, SelectField } from "./form-parts";

export type ProductFormValues = { id: string; golf_course_id: string; kind: string; name: string; is_active: boolean };
export type CourseOption = { id: string; name: string; is_active: boolean };

/**
 * 회원권 상품 생성·수정 폼. 제출은 onSubmit에서 직접 action을 불러
 * React 19의 <form action> 자동 리셋으로 입력값이 지워지지 않게 한다.
 * 새로 만들면 시세를 바로 입력할 수 있게 상품 화면으로, 수정이면 목록으로 이동한다.
 */
export function ProductForm({ product, courses }: { product?: ProductFormValues; courses: CourseOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MembershipFormState, FormData>(saveProduct, {});
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (!state.savedId) return;
    router.replace(product ? "/admin/memberships?tab=products" : `/admin/memberships/products/${state.savedId}`);
  }, [state.savedId, product, router]);

  const done = pending || !!state.savedId;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <SelectField id="product-course" name="golfCourseId" label="골프장" defaultValue={product?.golf_course_id ?? ""} error={errors.golfCourseId}>
        <option value="" disabled>골프장을 선택해 주세요</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.is_active ? c.name : `${c.name} (운영 중지)`}</option>
        ))}
      </SelectField>
      <FloatingInput
        id="product-kind" name="kind" label="종류" required maxLength={30} autoComplete="off"
        defaultValue={product?.kind} error={errors.kind}
      />
      <p className="-mt-2 px-1 text-micro text-muted-foreground">예: 정회원, 주중회원, 가족회원. 한 골프장에 같은 종류는 하나만 등록됩니다.</p>
      <FloatingInput
        id="product-name" name="name" label="상품명" required maxLength={100} autoComplete="off"
        defaultValue={product?.name} error={errors.name}
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-body">
        <input type="checkbox" name="isActive" defaultChecked={product?.is_active ?? true} className="size-5 shrink-0 accent-primary" />
        <span>
          판매 중
          <span className="ml-2 text-small text-muted-foreground">해제하면 고객 화면에 나오지 않고 매도 상담도 받지 않습니다</span>
        </span>
      </label>
      <FormAlert message={state.error} />
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/admin/memberships?tab=products">취소</Link>
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={done}>
          {done ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

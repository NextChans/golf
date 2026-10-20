"use client";

import { startTransition, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingInput } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { REGION_LABEL, REGIONS, type Region } from "@/lib/domain/course/schema";
import { cn } from "@/lib/utils";
import { saveCourse, type SaveCourseState } from "./actions";

export type CourseFormValues = {
  id: string;
  name: string;
  region: Region;
  address: string | null;
  weekday_green_fee: number | null;
  weekend_green_fee: number | null;
  cancellation_policy: string | null;
  contact_phone: string | null;
  is_active: boolean;
};

const won = new Intl.NumberFormat("ko-KR");
const feeText = (v: number | null | undefined) => (v === null || v === undefined ? "" : won.format(v));

const fieldLabelClass = "pointer-events-none absolute top-2.5 left-4 text-micro text-muted-foreground";
const boxClass = cn(
  "w-full rounded-xl border border-input bg-card text-body outline-none transition",
  "focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
);

function FieldError({ message }: { message?: string }) {
  return message ? <p className="px-1 text-small text-destructive">{message}</p> : null;
}

/**
 * 골프장 생성·수정 폼. 제출은 onSubmit에서 직접 action을 불러
 * React 19의 <form action> 자동 리셋으로 입력값이 지워지지 않게 한다(검증 실패 시 그대로 고칠 수 있도록).
 */
export function CourseForm({ course }: { course?: CourseFormValues }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SaveCourseState, FormData>(saveCourse, {});
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.savedId) router.replace("/admin/courses");
  }, [state.savedId, router]);

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
      <input type="hidden" name="id" value={course?.id ?? ""} />
      <FloatingInput
        id="course-name" name="name" label="이름" required maxLength={100} autoComplete="off"
        defaultValue={course?.name} error={errors.name}
      />
      <div className="space-y-1.5">
        <div className="relative">
          <select
            id="course-region" name="region" defaultValue={course?.region ?? "seoul_gyeonggi"}
            aria-invalid={errors.region ? true : undefined}
            className={cn(boxClass, "h-14 appearance-none pt-5 pr-10 pb-1.5 pl-4")}
          >
            {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
          </select>
          <label htmlFor="course-region" className={fieldLabelClass}>지역</label>
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rotate-90 text-muted-foreground">›</span>
        </div>
        <FieldError message={errors.region} />
      </div>
      <FloatingInput
        id="course-address" name="address" label="주소" maxLength={200} autoComplete="off"
        defaultValue={course?.address ?? ""} error={errors.address}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FloatingInput
          id="course-weekday-fee" name="weekdayGreenFee" label="주중 그린피" inputMode="numeric" autoComplete="off" suffix="원"
          defaultValue={feeText(course?.weekday_green_fee)} error={errors.weekdayGreenFee}
        />
        <FloatingInput
          id="course-weekend-fee" name="weekendGreenFee" label="주말 그린피" inputMode="numeric" autoComplete="off" suffix="원"
          defaultValue={feeText(course?.weekend_green_fee)} error={errors.weekendGreenFee}
        />
      </div>
      <FloatingInput
        id="course-phone" name="contactPhone" label="연락처" type="tel" maxLength={30} autoComplete="off"
        defaultValue={course?.contact_phone ?? ""} error={errors.contactPhone}
      />
      <div className="space-y-1.5">
        <div className="relative">
          <textarea
            id="course-policy" name="cancellationPolicy" maxLength={2000} rows={5}
            defaultValue={course?.cancellation_policy ?? ""}
            aria-invalid={errors.cancellationPolicy ? true : undefined}
            className={cn(boxClass, "block min-h-32 resize-y px-4 pt-7 pb-3")}
          />
          <label htmlFor="course-policy" className={fieldLabelClass}>취소 규정</label>
        </div>
        <FieldError message={errors.cancellationPolicy} />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-body">
        <input
          type="checkbox" name="isActive" defaultChecked={course?.is_active ?? true}
          className="size-5 shrink-0 accent-primary"
        />
        <span>
          운영 중
          <span className="ml-2 text-small text-muted-foreground">해제하면 고객 부킹 화면에 나오지 않습니다</span>
        </span>
      </label>
      {state.error && <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{state.error}</p>}
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/admin/courses">취소</Link>
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={done}>
          {done ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingInput, optionTileClass } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createMeeting, type FormState } from "../../../actions";
import { Chevron, FieldError, fieldLabelClass, formatDigits, selectClass, textareaClass } from "../../../fields";

type Course = { id: string; name: string; regionLabel: string };
const PLACE_OPTIONS = [
  { value: "course", label: "골프장", hint: "필드 라운딩" },
  { value: "free", label: "직접 입력", hint: "스크린·연습장" },
] as const;

export function MeetingForm({ groupId, courses, minLocal }: { groupId: string; courses: Course[]; minLocal: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(createMeeting, {});
  const [placeKind, setPlaceKind] = useState<"course" | "free">(courses.length ? "course" : "free");
  const [fee, setFee] = useState("");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.groupId) router.replace(`/groups/${state.groupId}#meetings`);
  }, [state.groupId, router]);
  const done = pending || !!state.groupId;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      <FloatingInput id="title" name="title" label="정모 이름" maxLength={60} error={errors.title} />
      <FloatingInput id="startsAt" name="startsAt" type="datetime-local" label="일시" min={minLocal} error={errors.startsAt} />

      <fieldset className="space-y-2">
        <legend className="mb-2 px-1 text-small font-medium">장소</legend>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="장소 종류">
          {PLACE_OPTIONS.map((o) => (
            <label key={o.value} className={cn(optionTileClass(placeKind === o.value), "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/30")}>
              <input
                type="radio" name="placeKind" value={o.value} className="sr-only"
                checked={placeKind === o.value} onChange={() => setPlaceKind(o.value)}
              />
              <span className={cn(placeKind === o.value && "font-semibold")}>{o.label}</span>
              <span className="mt-0.5 text-micro text-muted-foreground">{o.hint}</span>
            </label>
          ))}
        </div>
        <FieldError message={errors.placeKind} />
      </fieldset>
      {placeKind === "course" ? (
        <div className="space-y-1.5">
          <div className="relative">
            <select id="golfCourseId" name="golfCourseId" defaultValue="" className={selectClass} aria-invalid={errors.golfCourseId ? true : undefined}>
              <option value="" disabled>선택해 주세요</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.regionLabel})</option>)}
            </select>
            <label htmlFor="golfCourseId" className={fieldLabelClass}>골프장</label>
            <Chevron />
          </div>
          <FieldError message={errors.golfCourseId} />
        </div>
      ) : (
        <FloatingInput id="placeFree" name="placeFree" label="장소(스크린·연습장 등)" maxLength={100} error={errors.placeFree} />
      )}

      <FloatingInput id="capacity" name="capacity" label="정원" inputMode="numeric" suffix="명" defaultValue="4" error={errors.capacity} />
      <p className="-mt-2 px-1 text-micro text-muted-foreground">필드 라운딩은 4의 배수 권장(1팀 4명). 만든 사람은 자동으로 참석합니다.</p>
      <FloatingInput
        id="feePerPerson" name="feePerPerson" label="1인 회비(선택)" inputMode="numeric" suffix="원"
        value={fee} onChange={(e) => setFee(formatDigits(e.target.value, 8))} error={errors.feePerPerson}
      />
      <p className="-mt-2 px-1 text-micro text-muted-foreground">회비는 안내용이며 Googolf에서 결제하지 않습니다(현장 정산).</p>
      <div className="space-y-1.5">
        <div className="relative">
          <textarea id="note" name="note" maxLength={1000} rows={3} placeholder="모이는 곳, 준비물 등" className={textareaClass} aria-invalid={errors.note ? true : undefined} />
          <label htmlFor="note" className={fieldLabelClass}>안내(선택)</label>
        </div>
        <FieldError message={errors.note} />
      </div>
      <FieldError message={errors.groupId} />
      <div className="space-y-3 pt-4">
        {state.error && <p role="alert" className="text-center text-body text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={done}>{done ? "만드는 중…" : "정모 만들기"}</Button>
      </div>
    </form>
  );
}

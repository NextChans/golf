"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingInput, optionTileClass } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createBooking, type CreateBookingState } from "../actions";

type Course = { id: string; name: string; region: string };

const FREE_INPUT = "__free__";
// 시간 지정은 05:00~18:00, 30분 단위(D-12)
const HALF_HOURS = Array.from({ length: 27 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const TIME_OPTIONS = [
  { value: "part_1", label: "1부", hint: "06~10시" },
  { value: "part_2", label: "2부", hint: "11~15시" },
  { value: "range", label: "시간 지정", hint: "30분 단위" },
] as const;

// apple.com 폼 필드: 56px, 둥근 테두리, 필드 안쪽 상단의 작은 라벨
const fieldShellClass = "relative";
const fieldLabelClass = "pointer-events-none absolute top-2.5 left-4 text-micro text-muted-foreground";
const selectClass = cn(
  "h-14 w-full appearance-none rounded-xl border border-input bg-card pt-5 pr-10 pb-1.5 pl-4 text-body outline-none transition",
  "focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
);

function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-4 size-3 -translate-y-1/2 text-muted-foreground">
      <path d="M2 4.5 6 8.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="px-1 text-small text-destructive">{message}</p> : null;
}

function StepHeading({ id, step, children }: { id: string; step: number; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-eyebrow font-semibold tracking-tight md:text-title">
      <span className="mr-2 text-muted-foreground tabular-nums">{step}.</span>
      {children}
    </h2>
  );
}

export function BookingForm({ idempotencyKey, courses, minDate, maxDate }: {
  idempotencyKey: string; courses: Course[]; minDate: string; maxDate: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateBookingState, FormData>(createBooking, {});
  const [course, setCourse] = useState(courses[0]?.id ?? FREE_INPUT);
  const [timePref, setTimePref] = useState<(typeof TIME_OPTIONS)[number]["value"]>("part_1");
  const [players, setPlayers] = useState(4);
  const [budget, setBudget] = useState("");
  // 제출 전에 바로 알려줄 수 있는 오류는 입력 즉시 검증한다(apple-design §16). 최종 검증은 서버·DB가 한다.
  const [liveErrors, setLiveErrors] = useState<Record<string, string | undefined>>({});
  const errors = { ...(state.fieldErrors ?? {}), ...Object.fromEntries(Object.entries(liveErrors).filter(([, v]) => v)) };
  const validateDate = (value: string) =>
    setLiveErrors((e) => ({
      ...e,
      playDate: !value ? undefined : value < minDate ? "오늘 이후 날짜를 선택해 주세요." : value > maxDate ? "180일 이내 날짜만 요청할 수 있습니다." : undefined,
    }));
  const validateRange = (form: HTMLFormElement | null) => {
    if (!form) return;
    const from = (form.elements.namedItem("timeFrom") as HTMLSelectElement | null)?.value;
    const to = (form.elements.namedItem("timeTo") as HTMLSelectElement | null)?.value;
    setLiveErrors((e) => ({ ...e, timeTo: from && to && from >= to ? "종료 시각은 시작 시각보다 늦어야 합니다." : undefined }));
  };

  useEffect(() => {
    if (state.createdId) router.replace(`/bookings/${state.createdId}`);
  }, [state.createdId, router]);

  const done = pending || !!state.createdId;
  const courseError = errors.golfCourseId ?? errors.courseNameFree;

  return (
    <form action={action} className="flex flex-col gap-12 md:gap-14" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {/* 1. 골프장 */}
      <section aria-labelledby="step-course" className="space-y-4">
        <StepHeading id="step-course" step={1}>어디서 라운딩할까요?</StepHeading>
        <div className="space-y-3">
          <div className={fieldShellClass}>
            <select
              id="golfCourseId" name={course === FREE_INPUT ? undefined : "golfCourseId"}
              value={course} onChange={(e) => setCourse(e.target.value)} className={selectClass}
              aria-invalid={errors.golfCourseId ? true : undefined}
            >
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={FREE_INPUT}>목록에 없음(직접 입력)</option>
            </select>
            <label htmlFor="golfCourseId" className={fieldLabelClass}>골프장</label>
            <Chevron />
          </div>
          {course === FREE_INPUT && (
            <FloatingInput
              id="courseNameFree" name="courseNameFree" label="골프장 이름 직접 입력" maxLength={100}
              aria-invalid={errors.courseNameFree ? true : undefined}
            />
          )}
          <FieldError message={courseError} />
        </div>
      </section>

      {/* 2. 날짜·시간대 */}
      <section aria-labelledby="step-when" className="space-y-4">
        <StepHeading id="step-when" step={2}>언제 가실 건가요?</StepHeading>
        <FloatingInput
          id="playDate" name="playDate" label="라운딩 날짜" type="date"
          min={minDate} max={maxDate} required error={errors.playDate}
          onChange={(e) => validateDate(e.currentTarget.value)}
        />
        <fieldset className="space-y-3 pt-2">
          <legend className="mb-3 text-body font-semibold">희망 시간대</legend>
          <div className="grid grid-cols-3 gap-2.5">
            {TIME_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={cn(
                  optionTileClass(timePref === o.value),
                  "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/30",
                )}
              >
                <input
                  type="radio" name="timePref" value={o.value} className="sr-only"
                  checked={timePref === o.value} onChange={() => setTimePref(o.value)}
                />
                <span className={cn(timePref === o.value && "font-semibold")}>{o.label}</span>
                <span className="mt-0.5 text-micro text-muted-foreground">{o.hint}</span>
              </label>
            ))}
          </div>
          {timePref === "range" && (
            <div className="flex items-center gap-2.5">
              <div className={cn(fieldShellClass, "flex-1")}>
                <select id="timeFrom" name="timeFrom" defaultValue="07:00" className={selectClass} onChange={(e) => validateRange(e.currentTarget.form)}>
                  {HALF_HOURS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <label htmlFor="timeFrom" className={fieldLabelClass}>시작 시각</label>
                <Chevron />
              </div>
              <span aria-hidden className="text-muted-foreground">~</span>
              <div className={cn(fieldShellClass, "flex-1")}>
                <select id="timeTo" name="timeTo" defaultValue="09:00" className={selectClass} onChange={(e) => validateRange(e.currentTarget.form)}>
                  {HALF_HOURS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <label htmlFor="timeTo" className={fieldLabelClass}>종료 시각</label>
                <Chevron />
              </div>
            </div>
          )}
          <FieldError message={errors.timePref ?? errors.timeFrom ?? errors.timeTo} />
        </fieldset>
      </section>

      {/* 3. 인원 */}
      <section aria-labelledby="step-players" className="space-y-4">
        <StepHeading id="step-players" step={3}>몇 분이신가요?</StepHeading>
        <fieldset className="space-y-3">
          <legend className="sr-only">인원</legend>
          <input type="hidden" name="players" value={players} />
          <div className="grid grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n} type="button" onClick={() => setPlayers(n)} aria-pressed={players === n}
                className={cn(
                  optionTileClass(players === n),
                  "outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
                  players === n && "font-semibold",
                )}
              >
                {n}명
              </button>
            ))}
          </div>
          <FieldError message={errors.players} />
        </fieldset>
      </section>

      {/* 4. 예산·요청사항 */}
      <section aria-labelledby="step-extra" className="space-y-4">
        <StepHeading id="step-extra" step={4}>예산과 요청사항</StepHeading>
        <FloatingInput
          id="budgetPerPerson" name="budgetPerPerson" label="1인 그린피 예산(선택)" inputMode="numeric" suffix="원"
          value={budget} error={errors.budgetPerPerson}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
            setBudget(digits ? Number(digits).toLocaleString("ko-KR") : "");
          }}
        />
        <div className="space-y-1.5">
          <div className={fieldShellClass}>
            <textarea
              id="note" name="note" maxLength={1000} rows={4} placeholder="카트·캐디 요청, 동반자 정보 등"
              aria-invalid={errors.note ? true : undefined}
              className={cn(
                "block min-h-32 w-full resize-y rounded-xl border border-input bg-card px-4 pt-7 pb-3 text-body outline-none transition",
                "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
              )}
            />
            <label htmlFor="note" className={fieldLabelClass}>요청사항(선택)</label>
          </div>
          <FieldError message={errors.note} />
        </div>
      </section>

      <div className="space-y-3">
        {state.error && <p role="alert" className="text-center text-body text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" disabled={done}>{done ? "요청 중…" : "부킹 요청하기"}</Button>
        <p className="text-center text-micro text-muted-foreground">요청은 확정이 아니며, 담당자가 티타임을 찾아 제안해 드립니다.</p>
      </div>
    </form>
  );
}

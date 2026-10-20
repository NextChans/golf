"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
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
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.createdId) router.replace(`/bookings/${state.createdId}`);
  }, [state.createdId, router]);

  const done = pending || !!state.createdId;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="space-y-1.5">
        <Label htmlFor="golfCourseId">골프장</Label>
        <select
          id="golfCourseId" name={course === FREE_INPUT ? undefined : "golfCourseId"}
          value={course} onChange={(e) => setCourse(e.target.value)} className={fieldClass}
        >
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={FREE_INPUT}>목록에 없음(직접 입력)</option>
        </select>
        {course === FREE_INPUT && (
          <Input name="courseNameFree" placeholder="골프장 이름" maxLength={100} aria-label="골프장 이름 직접 입력" />
        )}
        <FieldError message={errors.golfCourseId ?? errors.courseNameFree} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="playDate">라운딩 날짜</Label>
        <Input id="playDate" name="playDate" type="date" min={minDate} max={maxDate} required />
        <FieldError message={errors.playDate} />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">희망 시간대</legend>
        <div className="grid grid-cols-3 gap-2">
          {TIME_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer flex-col items-center rounded-lg border px-2 py-2 text-sm transition",
                timePref === o.value && "border-primary bg-secondary font-semibold",
              )}
            >
              <input
                type="radio" name="timePref" value={o.value} className="sr-only"
                checked={timePref === o.value} onChange={() => setTimePref(o.value)}
              />
              {o.label}
              <span className="text-xs font-normal text-muted-foreground">{o.hint}</span>
            </label>
          ))}
        </div>
        {timePref === "range" && (
          <div className="flex items-center gap-2">
            <select name="timeFrom" aria-label="시작 시각" defaultValue="07:00" className={fieldClass}>
              {HALF_HOURS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <span aria-hidden>~</span>
            <select name="timeTo" aria-label="종료 시각" defaultValue="09:00" className={fieldClass}>
              {HALF_HOURS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        )}
        <FieldError message={errors.timePref ?? errors.timeFrom ?? errors.timeTo} />
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">인원</legend>
        <input type="hidden" name="players" value={players} />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n} type="button" onClick={() => setPlayers(n)} aria-pressed={players === n}
              className={cn("h-10 rounded-lg border text-sm transition", players === n && "border-primary bg-secondary font-semibold")}
            >
              {n}명
            </button>
          ))}
        </div>
        <FieldError message={errors.players} />
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="budgetPerPerson">1인 그린피 예산(선택)</Label>
        <div className="relative">
          <Input
            id="budgetPerPerson" name="budgetPerPerson" inputMode="numeric" placeholder="예: 200,000"
            value={budget}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
              setBudget(digits ? Number(digits).toLocaleString("ko-KR") : "");
            }}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">원</span>
        </div>
        <FieldError message={errors.budgetPerPerson} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">요청사항(선택)</Label>
        <textarea
          id="note" name="note" maxLength={1000} rows={3} placeholder="카트·캐디 요청, 동반자 정보 등"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <FieldError message={errors.note} />
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={done}>{done ? "요청 중…" : "부킹 요청하기"}</Button>
    </form>
  );
}

import { cn } from "@/lib/utils";

// 회원권 화면의 select·textarea 외형(bookings/new/booking-form.tsx와 같은 apple.com 폼 필드)
export const fieldLabelClass = "pointer-events-none absolute top-2.5 left-4 text-micro text-muted-foreground";
export const selectClass = cn(
  "h-14 w-full appearance-none rounded-xl border border-input bg-card pt-5 pr-10 pb-1.5 pl-4 text-body outline-none transition",
  "focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
);
export const textareaClass = cn(
  "block min-h-32 w-full resize-y rounded-xl border border-input bg-card px-4 pt-7 pb-3 text-body outline-none transition",
  "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
);

export function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-4 size-3 -translate-y-1/2 text-muted-foreground">
      <path d="M2 4.5 6 8.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="px-1 text-small text-destructive">{message}</p> : null;
}

/** 숫자만 남기고 천 단위 쉼표(최대 12자리 = 1,000억 미만 단위까지) */
export function formatDigits(value: string, maxDigits = 12): string {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

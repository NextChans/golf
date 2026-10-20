import { cn } from "@/lib/utils";

/** 회원권 관리 폼 공통 조각(골프장 폼과 같은 외형) */
export const fieldLabelClass = "pointer-events-none absolute top-2.5 left-4 text-micro text-muted-foreground";
export const boxClass = cn(
  "w-full rounded-xl border border-input bg-card text-body outline-none transition",
  "focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
  "disabled:cursor-not-allowed disabled:bg-section disabled:text-muted-foreground",
);

const won = new Intl.NumberFormat("ko-KR");
/** 180000 → "180,000"(입력 기본값), 값 없음 → "" */
export const amountText = (v: number | null | undefined) => (v === null || v === undefined ? "" : won.format(v));

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="px-1 text-small text-destructive">{message}</p> : null;
}

export function FormAlert({ message }: { message?: string }) {
  return message ? <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{message}</p> : null;
}

export function SelectField({ id, name, label, defaultValue, error, disabled, children }: {
  id: string; name?: string; label: string; defaultValue?: string; error?: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <select
          id={id} name={name} defaultValue={defaultValue} disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={cn(boxClass, "h-14 appearance-none pt-5 pr-10 pb-1.5 pl-4")}
        >
          {children}
        </select>
        <label htmlFor={id} className={fieldLabelClass}>{label}</label>
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rotate-90 text-muted-foreground">›</span>
      </div>
      <FieldError message={error} />
    </div>
  );
}

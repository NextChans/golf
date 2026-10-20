import { cn } from "@/lib/utils";

/**
 * apple.com 계정·결제 폼의 플로팅 라벨 입력(56px, 둥근 테두리).
 * label은 htmlFor로 연결되어 접근성 이름이 유지된다(E2E getByLabel).
 */
export function FloatingInput({ id, label, error, className, suffix, ...props }: {
  id: string; label: string; error?: string; suffix?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <input
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          className={cn(
            "peer h-14 w-full rounded-xl border border-input bg-card px-4 pt-5 pb-1.5 text-body outline-none transition",
            "focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
            suffix && "pr-12",
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body text-muted-foreground transition-all",
            "peer-focus:top-4 peer-focus:text-micro peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-micro",
            "peer-[[type=date]]:top-4 peer-[[type=date]]:text-micro",
          )}
        >
          {label}
        </label>
        {suffix && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">{suffix}</span>}
      </div>
      {error && <p className="px-1 text-small text-destructive">{error}</p>}
    </div>
  );
}

/** 선택형 옵션 타일(apple.com 제품 구성 선택처럼). 라디오/토글 버튼의 공통 외형. */
export const optionTileClass = (selected: boolean) =>
  cn(
    "pressable flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border px-3 py-3 text-center text-body",
    selected ? "border-2 border-primary px-[11px] py-[11px]" : "border-input hover:border-muted-foreground",
  );

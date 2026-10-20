import { cn } from "@/lib/utils";

/** apple.com 제품 페이지의 로컬 내비(서브내비): 페이지 이름 + 오른쪽 작은 알약 CTA. 글로벌 내비 아래 고정, 구분선 대신 경계 페이드. */
export function LocalNav({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("material-bar scroll-edge sticky top-12 z-30", className)}>
      <div className="mx-auto flex h-[52px] max-w-[1024px] items-center justify-between px-4">
        <p className="text-eyebrow font-semibold tracking-tight">{title}</p>
        {action}
      </div>
    </div>
  );
}

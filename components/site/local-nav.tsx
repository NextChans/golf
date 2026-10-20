import { cn } from "@/lib/utils";

/** apple.com 제품 페이지의 로컬 내비(서브내비): 페이지 이름 + 오른쪽 작은 알약 CTA. 스크롤 시 글로벌 내비 아래에 고정. */
export function LocalNav({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky top-12 z-30 border-b border-border/70 bg-nav backdrop-blur-xl backdrop-saturate-150", className)}>
      <div className="mx-auto flex h-[52px] max-w-[1024px] items-center justify-between px-4">
        <p className="text-eyebrow font-semibold tracking-tight">{title}</p>
        {action}
      </div>
    </div>
  );
}

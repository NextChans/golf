import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "white" | "gray" | "dark";
const toneClass: Record<Tone, string> = {
  white: "bg-background text-foreground",
  gray: "bg-section text-foreground",
  dark: "bg-[#000] text-[#f5f5f7]",
};

/** 전폭 섹션. 흰색·연회색·검정 배경을 번갈아 쓴다. */
export function Section({ tone = "white", className, inner, children, ...rest }: {
  tone?: Tone; className?: string; inner?: string; children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn(toneClass[tone], className)} {...rest}>
      <div className={cn("mx-auto max-w-[1024px] px-4", inner)}>{children}</div>
    </section>
  );
}

/** 큰 라운드 타일(제품 하이라이트 카드). */
export function Tile({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-tile-lg bg-section p-7 md:p-10", className)} {...rest}>{children}</div>;
}

/** "더 알아보기 ›" 형식 링크 */
export function MoreLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href as never} className={cn("pressable inline-flex items-center gap-0.5 text-primary hover:underline underline-offset-4", className)}>
      {children}
      <span aria-hidden className="text-[1.1em] leading-none">›</span>
    </Link>
  );
}

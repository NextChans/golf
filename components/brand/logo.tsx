import Link from "next/link";
import { cn } from "@/lib/utils";

/** Googolf 로고. 심볼은 public/brand/googolf-mark.svg와 같은 도형을 인라인으로 그린다(색 테마 대응). */
export function Logo({ href = "/", className }: { href?: "/" | "/admin"; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)} aria-label="Googolf 홈">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#1B6B45" />
        <ellipse cx="32" cy="46" rx="20" ry="6" fill="#C6E26B" />
        <ellipse cx="32" cy="46" rx="4.5" ry="1.8" fill="#0F3D27" />
        <rect x="31" y="14" width="2.4" height="32" rx="1.2" fill="#FFFFFF" />
        <path d="M33.4 14 L48 19.5 L33.4 25 Z" fill="#C6E26B" />
      </svg>
      <span className="text-xl text-primary">
        Goo<span className="text-[#5E8C2A] dark:text-brand-lime">golf</span>
      </span>
    </Link>
  );
}

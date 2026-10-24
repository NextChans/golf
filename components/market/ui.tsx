import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 회원권 앱 공통 UI(D-80, docs/DESIGN-APP.md). 서버 컴포넌트에서 쓸 수 있는 정적 조각만 둔다.
 * 상호작용(팝업·칩 토글·관심)은 같은 폴더의 클라이언트 컴포넌트에.
 */

/** 앱 화면 틀: 모바일 폭(최대 480px) 중앙, 하단 탭 바 높이만큼 여백 */
export function AppScreen({ children, tone = "surface", className, withTabBar = true }: {
  children: React.ReactNode; tone?: "surface" | "canvas"; className?: string; withTabBar?: boolean;
}) {
  return (
    <div className={cn("min-h-dvh", tone === "canvas" ? "bg-canvas" : "bg-surface")}>
      <div className={cn("mx-auto min-h-dvh max-w-[480px] text-ink", withTabBar && "pb-[calc(4rem+env(safe-area-inset-bottom))]", className)}>
        {children}
      </div>
    </div>
  );
}

/** 가운데 제목 상단 바(56px). back이 있으면 왼쪽 뒤로가기 */
export function TopBar({ title, back, right }: { title: string; back?: Route; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-surface">
      <div className="relative flex h-14 items-center justify-center px-4">
        {back && (
          <Link href={back} aria-label="뒤로" className="pressable absolute left-2 flex size-11 items-center justify-center text-ink">
            <ChevronLeft className="size-7" aria-hidden />
          </Link>
        )}
        <h1 className="text-subhead font-bold text-ink-sub">{title}</h1>
        {right && <div className="absolute right-2 flex items-center">{right}</div>}
      </div>
    </header>
  );
}

/** 굵은 구분 띠(메뉴 묶음 사이) */
export const Divider = () => <div aria-hidden className="h-2.5 bg-fill" />;

export function MenuGroup({ children, label }: { children: React.ReactNode; label?: string }) {
  return <ul aria-label={label} className="py-2">{children}</ul>;
}

export function MenuRow({ href, children, trailing }: { href: Route; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="pressable flex h-[68px] items-center justify-between px-6 text-subhead font-semibold text-ink-sub hover:bg-fill/60">
        <span>{children}</span>
        <span className="flex items-center gap-2 text-caption font-medium text-ink-mute">
          {trailing}
          <ChevronRight className="size-5 text-ink-mute" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

/** 로그인 유도 행: 회색 아바타 + "로그인 · 회원가입 ›" + 한 줄 설명(강조 단어는 그린) */
export function LoginPrompt({ href, lead, emphasis, tail, boxed = false, name }: {
  href: Route; lead: string; emphasis: string; tail: string; boxed?: boolean; name?: string | null;
}) {
  return (
    <Link
      href={href}
      className={cn("pressable flex items-center gap-4", boxed ? "rounded-card bg-fill px-6 py-8" : "px-6 py-6")}
    >
      <span aria-hidden className="flex size-[58px] shrink-0 items-center justify-center rounded-full bg-line/70">
        <UserRound className="size-7 fill-ink-mute/70 text-ink-mute/70" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-heading font-bold text-ink">
          {name ?? "로그인 · 회원가입"}
          <ChevronRight className="size-5 text-ink-mute" aria-hidden />
        </span>
        <span className="mt-1 block text-caption text-ink-sub">
          {lead}
          <b className="font-semibold text-brand-ink">{emphasis}</b>
          {tail}
        </span>
      </span>
    </Link>
  );
}

/** 상태 화면(빈 상태·에러) */
export function StateView({ title, body, action, tone = "empty" }: {
  title: string; body?: string; action?: React.ReactNode; tone?: "empty" | "error";
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <p role={tone === "error" ? "alert" : undefined} className={cn("text-subhead font-bold", tone === "error" ? "text-up" : "text-ink")}>{title}</p>
      {body && <p className="mt-2 max-w-[320px] text-caption text-ink-mute">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** 주요 버튼(56px, 12px 라운드). asChild 대신 링크/버튼 둘 다 이 클래스로 */
export const primaryButtonClass =
  "pressable inline-flex h-14 items-center justify-center rounded-control bg-brand px-6 text-subhead font-bold text-white hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-40";
export const secondaryButtonClass =
  "pressable inline-flex h-14 items-center justify-center rounded-control border border-line bg-surface px-6 text-subhead font-bold text-ink-sub hover:bg-fill";
/** 선택 칩(가격대 등). aria-pressed로 선택 상태 */
export const chipClass =
  "pressable inline-flex h-12 items-center rounded-control border border-line bg-surface px-4 text-label font-semibold text-ink-sub aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-ink";

/** 변화율 텍스트 색: 상승 빨강, 하락 파랑, 보합 회색 */
export const rateClass = (rate: number) => (rate > 0 ? "text-up" : rate < 0 ? "text-down" : "text-ink-mute");

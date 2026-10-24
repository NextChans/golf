import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";

/** 주간 시세 리포트 배너(하늘색, 그림 대신 아이콘) */
export function ReportBanner() {
  return (
    <Link href="/market/report" className="pressable flex min-h-32 items-center justify-between gap-4 bg-info-soft px-6 py-6">
      <span>
        <span className="block text-caption font-semibold text-ink-sub">회원권 판매, 아직 고민 중이라면?</span>
        <span className="mt-1 block text-heading font-bold text-ink">주간 시세 리포트<br />먼저 받아보기</span>
      </span>
      <ChartNoAxesCombined aria-hidden className="size-16 shrink-0 text-info" strokeWidth={1.5} />
    </Link>
  );
}

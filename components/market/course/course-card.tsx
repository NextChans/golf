import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CourseGroup } from "@/lib/domain/market/group";
import { MARKET_REGION_LABEL } from "@/lib/domain/market/schema";
import { CourseAvatar, TypeRows } from "./type-rows";

/** 검색 결과 골프장 카드: 위 헤더(→ 골프장 상세) + 아래 회원권 유형 행(→ 회원권 상세) */
export function CourseCard({ group }: { group: CourseGroup }) {
  return (
    <li className="rounded-card border border-line bg-surface p-4">
      <Link
        href={`/market/courses/${group.courseId}`}
        aria-label={`골프장 정보: ${group.courseName}`}
        className="pressable flex min-h-14 items-center gap-3"
      >
        <CourseAvatar name={group.courseName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label font-bold text-ink">{group.courseName}</span>
          <span className="block text-caption text-ink-mute">{MARKET_REGION_LABEL[group.region]}·{group.holes}홀</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-faint" />
      </Link>
      <TypeRows items={group.items} courseName={group.courseName} className="mt-3" />
    </li>
  );
}

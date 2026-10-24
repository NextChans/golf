import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MARKET_REGION_LABEL, type MarketItem } from "@/lib/domain/market/schema";
import { KindSelect } from "./kind-select";

/** 사진 아래 요약: 첫 글자 아바타 + 골프장명(›골프장 상세) + 회원권 유형 + 지역·홀 + 종류 선택 */
export function DetailSummary({ item, siblings }: { item: MarketItem; siblings: { id: string; kind: MarketItem["kind"] }[] }) {
  return (
    <section aria-label="회원권 요약" className="relative -mt-6 rounded-t-sheet bg-surface px-6 pt-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-card border border-line bg-surface text-subhead font-semibold text-brand-ink">
          {item.courseName.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/market/courses/${item.courseId}`} className="pressable -my-1 flex min-h-11 min-w-0 items-center text-ink">
              <h1 className="truncate text-label font-bold">{item.courseName}</h1>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-mute" />
              <span className="sr-only">골프장 정보 보기</span>
            </Link>
            <p className="shrink-0 pt-2 text-caption font-semibold text-ink-sub">{MARKET_REGION_LABEL[item.region]}·{item.holes}홀</p>
          </div>
          <p className="text-heading font-bold text-ink">{item.kind}</p>
        </div>
      </div>
      <div className="mt-5">
        <KindSelect currentId={item.id} options={siblings} />
      </div>
    </section>
  );
}

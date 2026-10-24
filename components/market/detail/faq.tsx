import Link from "next/link";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

/** 확정되지 않은 보장·기간·보관 방식은 단정하지 않고 "담당자 안내"로 쓴다(표시광고법, D-80) */
const DETAIL_FAQ = [
  { q: "거래는 어떤 순서로 진행되나요?", a: "구매·판매 문의 → 담당자 상담 → 계약 → 잔금 → 명의개서 순서로 진행해요. 단계마다 담당자가 안내해 드려요." },
  { q: "거래는 얼마나 걸리나요?", a: "회원권과 골프장 규정에 따라 달라서 정해진 기간을 약속드리기 어려워요. 상담 때 담당자가 예상 일정을 안내해 드려요." },
  { q: "거래 대금은 어떻게 보관되나요?", a: "대금 보관 방식은 현재 검토 중이에요. 확정되면 이 화면과 약관에 먼저 공지하고, 그 전에는 담당자가 진행 방식을 직접 안내해 드려요." },
  { q: "수수료는 얼마인가요?", a: "수수료 기준은 확정 전 예시예요. 위 거래 비용 계산기에서 예상 금액을 볼 수 있고, 계약 전에 최종 금액을 안내해 드려요. 명의개서 비용과 세금은 별도예요." },
  { q: "내 회원권도 판매할 수 있나요?", a: "판매 희망가를 등록하면 담당자가 회원권 정보를 확인해요. 골프장 규정이나 회원권 상태에 따라 판매가 어려울 수도 있어서, 가능 여부는 확인 후 안내해 드려요." },
] as const;

export function DetailFaq() {
  return (
    <section aria-labelledby="faq-title" className="px-6 py-8">
      <h2 id="faq-title" className="text-heading font-bold text-ink">자주 묻는 질문</h2>
      <div className="mt-2">
        {DETAIL_FAQ.map((f) => (
          <details key={f.q} className="group border-b border-line last:border-0">
            <summary className="pressable flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 py-3 text-label font-bold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-mute transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-5 text-label text-ink-sub">{f.a}</p>
          </details>
        ))}
      </div>
      <Link href="/market/guide/guarantee" className="pressable mt-6 flex items-center gap-3 rounded-card bg-fill px-4 py-5">
        <ShieldCheck className="size-8 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-label font-bold text-ink">안심 거래 보장</span>
          <span className="text-caption text-ink-mute">대금 보호부터 명의개서 완료까지 담당자가 함께합니다</span>
        </span>
        <ChevronRight aria-hidden className="size-5 text-ink-mute" />
      </Link>
    </section>
  );
}

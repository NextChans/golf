import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AppScreen, primaryButtonClass, TopBar } from "@/components/market/ui";

export const metadata: Metadata = { title: "안심 거래 보장" };

/** 보장 항목은 초안이다. 실제 보장 범위·한도는 약관·법률 검토 후 확정(D-80 비고) */
const STEPS = [
  { t: "본인 확인", d: "거래 당사자를 본인 인증으로 확인합니다." },
  { t: "대금 보호", d: "명의개서가 끝날 때까지 거래대금을 안전하게 보관하는 방식을 검토 중입니다." },
  { t: "권리 확인", d: "골프장에 회원 자격·미납금·양도 제한을 미리 확인합니다." },
  { t: "계약 동행", d: "담당자가 계약서 작성부터 잔금까지 함께합니다." },
  { t: "명의개서 완료", d: "골프장 명의개서 완료까지 단계별로 알려 드립니다." },
] as const;

export default function GuaranteePage() {
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="안심 거래 보장" back="/" />
      <main className="px-6 pt-4 pb-12">
        <div className="rounded-card bg-gradient-to-b from-[#3b5fc0] to-[#9cc0f5] p-7 text-white">
          <ShieldCheck className="size-12" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-4 text-heading font-bold">회원권 거래,<br />처음부터 끝까지 안심하세요</h2>
        </div>
        <ol className="mt-8 space-y-5">
          {STEPS.map((s, k) => (
            <li key={s.t} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-caption font-bold text-brand-ink">{k + 1}</span>
              <span>
                <span className="block text-label font-bold text-ink">{s.t}</span>
                <span className="text-caption text-ink-sub">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-tiny text-ink-faint">미리보기 안내문입니다. 보장 범위와 조건은 서비스 정식 오픈 때 약관으로 안내합니다.</p>
        <Link href="/market/search/results" className={`${primaryButtonClass} mt-6 w-full`}>회원권 둘러보기</Link>
      </main>
    </AppScreen>
  );
}

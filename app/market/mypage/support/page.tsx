import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { AppScreen, Divider, TopBar } from "@/components/market/ui";
import { FAQ, SUPPORT } from "@/lib/mock/market";

export const metadata: Metadata = { title: "고객센터" };

export default function SupportPage() {
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="고객센터" back="/market/mypage" />
      <main className="pb-10">
        <section className="px-6 pt-4 pb-7">
          <p className="text-heading font-extrabold text-ink">무엇을 도와드릴까요?</p>
          <p className="mt-1 text-caption text-ink-mute">{SUPPORT.hours}</p>
          <a href={`tel:${SUPPORT.phone}`} className="pressable mt-5 flex h-14 items-center justify-center gap-2 rounded-control bg-brand text-subhead font-bold text-white">
            <Phone className="size-5" aria-hidden /> 전화 상담 {SUPPORT.phone}
          </a>
        </section>
        <Divider />
        <section aria-labelledby="faq-title" className="px-6 pt-6">
          <h2 id="faq-title" className="text-subhead font-bold text-ink">자주 묻는 질문</h2>
          <ul className="mt-2 divide-y divide-line">
            {FAQ.map((f) => (
              <li key={f.q}>
                <details className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-label font-semibold text-ink-sub">
                    {f.q}
                    <span aria-hidden className="text-ink-mute transition group-open:rotate-90">›</span>
                  </summary>
                  <p className="mt-3 rounded-control bg-fill p-4 text-caption text-ink-sub">{f.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppScreen>
  );
}

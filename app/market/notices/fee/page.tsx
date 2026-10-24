import type { Metadata } from "next";
import { AppScreen, TopBar } from "@/components/market/ui";
import { brokerageFee, formatManWon } from "@/lib/domain/market/schema";
import { FEE_NOTICE, FEE_POLICY } from "@/lib/mock/market";

export const metadata: Metadata = { title: FEE_NOTICE.termsTitle };

const EXAMPLES = [
  { price: 48_000_000, kind: "개인 정회원" },
  { price: 30_000_000, kind: "주중 회원" },
  { price: 480_000_000, kind: "개인 정회원" },
] as const;

export default function FeeNoticePage() {
  const rate = (FEE_POLICY.rateBp / 100).toFixed(1);
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="공지사항" back="/" />
      <main className="px-6 pt-4 pb-12">
        <p className="text-caption font-semibold text-brand-ink">안내</p>
        <h2 className="mt-1 text-heading font-bold text-ink">{FEE_NOTICE.termsTitle}</h2>
        <p className="mt-3 text-label text-ink-sub">{FEE_NOTICE.body} 시행일은 {FEE_NOTICE.effectiveDate.replaceAll("-", ".")}입니다.</p>

        <h3 className="mt-8 text-subhead font-bold text-ink">바뀌는 수수료</h3>
        <table className="mt-3 w-full overflow-hidden rounded-card text-left text-caption">
          <tbody className="divide-y divide-line bg-fill">
            <tr><th className="px-4 py-3 font-semibold text-ink-mute">{formatManWon(FEE_POLICY.threshold)} 이하</th><td className="px-4 py-3 font-bold">{formatManWon(FEE_POLICY.flat)} 정액 (주중 회원 {formatManWon(FEE_POLICY.flatWeekday)})</td></tr>
            <tr><th className="px-4 py-3 font-semibold text-ink-mute">{formatManWon(FEE_POLICY.threshold)} 초과</th><td className="px-4 py-3 font-bold">거래금액의 {rate}%</td></tr>
          </tbody>
        </table>

        <h3 className="mt-8 text-subhead font-bold text-ink">계산 예시</h3>
        <ul className="mt-3 space-y-2 text-caption text-ink-sub">
          {EXAMPLES.map((e) => (
            <li key={`${e.price}-${e.kind}`} className="flex justify-between rounded-control border border-line px-4 py-3">
              <span>{e.kind} {formatManWon(e.price)}</span>
              <b className="tabular-nums">{formatManWon(brokerageFee(e.price, e.kind, FEE_POLICY))}</b>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-caption text-ink-mute">{FEE_NOTICE.termsSummary}. 수수료는 거래 전에 최종 금액을 먼저 안내해 드립니다(수수료 정찰제).</p>
      </main>
    </AppScreen>
  );
}

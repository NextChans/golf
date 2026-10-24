import { CarFront, UserRound } from "lucide-react";
import type { MarketDetail } from "@/lib/mock/market-detail";

const won = (n: number | null) => (n === null ? "이용 불가" : `${n.toLocaleString("ko-KR")}원`);

/** 이용 정보: 부킹 특이사항(회색 박스), 그린피 표, 카트·캐디비 */
export function UsageInfo({ detail }: { detail: Pick<MarketDetail, "bookingNotes" | "greenFees" | "cartFee" | "caddieFee"> }) {
  return (
    <div>
      <h2 className="text-heading font-extrabold text-ink">이용 정보</h2>

      <h3 className="mt-6 text-subhead font-bold text-ink">부킹 특이사항</h3>
      <div className="mt-3 space-y-4 rounded-card bg-fill px-5 py-5">
        {detail.bookingNotes.map((n) => (
          <div key={n.title}>
            <p className="text-label font-bold text-ink">{n.title}</p>
            <ul className="mt-1 space-y-1">
              {n.lines.map((l) => (
                <li key={l} className="flex gap-2 text-label text-ink-sub"><span aria-hidden>•</span>{l}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-caption text-ink-mute">예약 규칙은 예시예요. 정확한 내용은 담당자가 확인해 안내해 드려요.</p>
      </div>

      <h3 className="mt-8 text-subhead font-bold text-ink">그린피</h3>
      <table className="mt-3 w-full overflow-hidden rounded-card border-separate border-spacing-0 border border-line text-left">
        <caption className="sr-only">회원 구분별 주중·주말 그린피</caption>
        <thead>
          <tr className="bg-fill text-label text-ink-sub">
            <th scope="col" className="w-[32%] px-3 py-3 font-semibold">구분</th>
            <th scope="col" className="border-l border-line px-3 py-3 font-semibold">주중</th>
            <th scope="col" className="border-l border-line px-3 py-3 font-semibold">주말</th>
          </tr>
        </thead>
        <tbody>
          {detail.greenFees.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="border-t border-line bg-fill px-3 py-4 text-label font-semibold text-ink-sub">{r.label}</th>
              <td className="border-t border-l border-line px-3 py-4 text-caption font-bold text-ink tabular-nums">{won(r.weekday)}</td>
              <td className="border-t border-l border-line px-3 py-4 text-caption font-bold text-ink tabular-nums">{won(r.weekend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-ink-mute">금액은 예시이며 시기·요일에 따라 달라질 수 있어요.</p>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        <li className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-card bg-info-soft text-info"><CarFront aria-hidden className="size-7" /></span>
          <span><span className="block text-label font-bold text-ink tabular-nums">{won(detail.cartFee)}</span><span className="text-caption text-ink-mute">카트</span></span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand-ink"><UserRound aria-hidden className="size-7" /></span>
          <span><span className="block text-label font-bold text-ink tabular-nums">{won(detail.caddieFee)}</span><span className="text-caption text-ink-mute">캐디비</span></span>
        </li>
      </ul>
    </div>
  );
}

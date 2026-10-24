import { MapPin } from "lucide-react";
import type { MarketDetail } from "@/lib/mock/market-detail";
import { CopyAddress } from "./copy-address";

/** 지도 자리: 외부 지도 이미지·API 없이 SVG 격자 + 핀 */
function MapPlaceholder({ name }: { name: string }) {
  return (
    <div role="img" aria-label={`${name} 위치 지도(준비 중)`} className="relative mt-3 h-52 overflow-hidden rounded-card border border-line bg-fill">
      <svg aria-hidden viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute inset-0 size-full text-line">
        <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
          {[20, 40, 60, 80, 100, 120, 140, 160, 180].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="100" vectorEffect="non-scaling-stroke" />)}
          {[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="200" y2={y} vectorEffect="non-scaling-stroke" />)}
        </g>
        <path d="M0 70 C50 55 90 80 130 50 S190 40 200 30" fill="none" stroke="var(--ink-faint)" strokeWidth="3" vectorEffect="non-scaling-stroke" opacity="0.5" />
      </svg>
      <MapPin aria-hidden className="absolute top-[38%] left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 fill-brand text-brand-ink" />
      <span className="absolute inset-x-0 bottom-3 text-center text-caption font-semibold text-ink-mute">지도 준비 중</span>
    </div>
  );
}

/** 골프장 정보: 주소(복사), 지도 자리, 전화·홈페이지·회원수·규모·개장일 표 */
export function CourseInfo({ name, holes, detail }: { name: string; holes: number; detail: MarketDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["전화", <a key="t" href={detail.phone.href} className="font-bold text-info underline underline-offset-4">{detail.phone.label}</a>],
    ["홈페이지", <span key="h" className="font-bold text-ink-mute">(준비 중)</span>],
    ["회원수", <span key="m" className="font-bold text-ink">{detail.members.toLocaleString("ko-KR")}명</span>],
    ["규모", <span key="s" className="font-bold text-ink">{holes}홀</span>],
    ["개장일", <span key="o" className="font-bold text-ink">{detail.openedOn}</span>],
  ];
  return (
    <div>
      <h2 className="text-heading font-bold text-ink">골프장 정보</h2>
      <div className="mt-2"><CopyAddress address={detail.address} /></div>
      <MapPlaceholder name={name} />
      <dl className="mt-4 overflow-hidden rounded-card border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex border-t border-line first:border-t-0">
            <dt className="w-[32%] shrink-0 bg-fill px-4 py-4 text-label font-semibold text-ink-sub">{k}</dt>
            <dd className="flex min-w-0 flex-1 items-center px-4 py-4 text-label break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-caption text-ink-mute">주소·연락처·회원수는 예시 데이터예요.</p>
    </div>
  );
}

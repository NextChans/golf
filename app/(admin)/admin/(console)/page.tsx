import type { Metadata } from "next";
import { Tile } from "@/components/site/section";

export const metadata: Metadata = { title: "운영자 홈", robots: { index: false } };

const tiles = [
  { title: "요청 인박스", body: "부킹 요청 인박스는 M4에서 열립니다.", status: "준비 중" },
  { title: "회원권 상담", body: "회원권 매수·매도 상담 관리는 이후 마일스톤에서 열립니다.", status: "준비 중" },
] as const;

export default function AdminHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title tracking-tight">운영자 홈</h1>
        <p className="mt-2 text-body text-muted-foreground">오늘 처리할 요청과 상담을 한곳에서 확인합니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tiles.map((t) => (
          <Tile key={t.title} className="p-6 md:p-8">
            <p className="text-micro font-semibold text-muted-foreground">{t.status}</p>
            <h2 className="mt-1 text-eyebrow tracking-tight">{t.title}</h2>
            <p className="mt-3 text-small text-muted-foreground">{t.body}</p>
          </Tile>
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "회원권 거래", template: "%s · Googolf 회원권" },
  description: "골프 회원권 시세 조회부터 매매 상담까지. Googolf 회원권",
};

/** 회원권 앱(D-80). 모든 화면이 목업 데이터를 쓰는 동안 상단에 안내 띠를 둔다 */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="bg-ink py-1 text-center text-tiny font-medium text-surface">미리보기 · 시세와 매물은 예시 데이터입니다</p>
      {children}
    </>
  );
}

import type { Metadata } from "next";
import { MarketShell } from "@/components/market/market-shell";

export const metadata: Metadata = {
  title: { default: "회원권 거래", template: "%s · Googolf 회원권" },
  description: "골프 회원권 시세 조회부터 매매 상담까지. Googolf 회원권",
};

/** 회원권 앱(D-80). 앱 홈은 루트(/)로 옮겼고(D-87) `/market`은 next.config redirects로 /에 보낸다 */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <MarketShell>{children}</MarketShell>;
}

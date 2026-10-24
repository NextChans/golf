import type { Metadata } from "next";
import { MarketHomeScreen } from "@/components/market/home-screen";
import { MarketShell } from "@/components/market/market-shell";
import { TabBar } from "@/components/market/tab-bar";

export const metadata: Metadata = {
  title: { absolute: "Googolf — 골프 회원권 거래" },
  description: "골프 회원권 시세 조회부터 매매 상담까지. Googolf",
};

/**
 * 루트 = 회원권 앱 홈(D-87). URL은 `/` 그대로 두고, `/market`의 두 레이아웃(앱 껍데기·하단 탭 바)을
 * 같은 컴포넌트로 직접 감싼다. 로그인 여부와 관계없이 공개(lib/auth/routing.ts 보호 경로 아님).
 */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <MarketShell>
      <MarketHomeScreen searchParams={await searchParams} />
      <TabBar />
    </MarketShell>
  );
}

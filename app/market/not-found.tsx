import type { Metadata } from "next";
import Link from "next/link";
import { AppScreen, primaryButtonClass, StateView, TopBar } from "@/components/market/ui";

export const metadata: Metadata = { title: "찾을 수 없어요" };

/** 회원권 앱 404(없는 골프장·회원권). 앱 틀 안에서 홈으로 돌아가게 한다 */
export default function MarketNotFound() {
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="찾을 수 없어요" back="/" />
      <main>
        <StateView
          title="페이지를 찾을 수 없어요"
          body="주소가 바뀌었거나 없는 골프장·회원권이에요."
          action={<Link href="/" className={primaryButtonClass}>회원권 홈으로</Link>}
        />
      </main>
    </AppScreen>
  );
}

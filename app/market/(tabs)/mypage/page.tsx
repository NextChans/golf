import type { Metadata } from "next";
import { AppScreen, Divider, LoginPrompt, MenuGroup, MenuRow, TopBar } from "@/components/market/ui";
import { getSession } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { COUPONS } from "@/lib/mock/market";

export const metadata: Metadata = { title: "마이페이지" };

export default async function MyPage() {
  const session = await getSession();
  const customer = session?.role === "customer";
  let name: string | null = null;
  if (customer) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("display_name").eq("id", session.userId).maybeSingle();
    name = data?.display_name ?? "고객";
  }
  const coupons = COUPONS.filter((c) => !c.used).length;

  return (
    <AppScreen>
      <TopBar title="마이페이지" />
      <main>
        {customer ? (
          <LoginPrompt href="/me" name={`${name}님`} lead="" emphasis="회원권 거래" tail="를 Googolf와 함께하세요" />
        ) : (
          <LoginPrompt href="/market/login?next=/market/mypage" lead="간편한 " emphasis="회원권 거래 경험" tail="을 시작해보세요" />
        )}
        <Divider />
        <MenuGroup label="관심·혜택">
          <MenuRow href="/market/mypage/favorites">관심 회원권</MenuRow>
          <MenuRow href="/market/mypage/coupons" trailing={coupons ? `${coupons}장` : undefined}>쿠폰함</MenuRow>
          <MenuRow href="/market/mypage/asks">판매 희망가</MenuRow>
        </MenuGroup>
        <Divider />
        <MenuGroup label="거래·계정">
          <MenuRow href="/me">개인정보</MenuRow>
          <MenuRow href="/market/mypage/trades?type=sell">판매 관리</MenuRow>
          <MenuRow href="/market/mypage/trades?type=buy">구매 관리</MenuRow>
          <MenuRow href="/market/mypage/settings">설정</MenuRow>
        </MenuGroup>
        <Divider />
        <MenuGroup label="도움말">
          <MenuRow href="/market/mypage/support">고객센터</MenuRow>
        </MenuGroup>
      </main>
    </AppScreen>
  );
}

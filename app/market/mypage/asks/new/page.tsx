import type { Metadata } from "next";
import { AskForm } from "@/components/market/ask-form";
import { AppScreen, LoginPrompt, TopBar } from "@/components/market/ui";
import { getSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "판매 희망가 등록" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewAskPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const item = typeof sp.item === "string" ? sp.item : null;
  const session = await getSession();
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="판매 희망가 등록" back="/market/mypage/asks" />
      <main className="px-6 pt-4 pb-10">
        {session?.role === "customer" ? (
          <>
            <h2 className="mb-6 text-heading font-extrabold text-ink">얼마에 팔고 싶으세요?</h2>
            <AskForm initialItem={item} />
          </>
        ) : (
          <LoginPrompt
            boxed
            href={`/login?next=${encodeURIComponent(`/market/mypage/asks/new${item ? `?item=${item}` : ""}`)}` as never}
            lead="로그인하고 " emphasis="판매 희망가" tail="를 등록해 보세요."
          />
        )}
      </main>
    </AppScreen>
  );
}

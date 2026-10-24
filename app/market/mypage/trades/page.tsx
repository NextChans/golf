import type { Metadata } from "next";
import Link from "next/link";
import { AppScreen, LoginPrompt, StateView, TopBar } from "@/components/market/ui";
import { getSession } from "@/lib/auth/guards";
import { DEAL_STAGES, DEAL_STATUS_LABEL } from "@/lib/domain/membership/status";

export const metadata: Metadata = { title: "거래 관리" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 판매·구매 관리. 실제 거래 내역은 기존 /deals(실데이터)에 있으므로 진행 단계 안내와 함께 그곳으로 잇는다 */
export default async function TradesPage({ searchParams }: { searchParams: SearchParams }) {
  const type = (await searchParams).type === "sell" ? "sell" : "buy";
  const title = type === "sell" ? "판매 관리" : "구매 관리";
  const session = await getSession();
  return (
    <AppScreen withTabBar={false}>
      <TopBar title={title} back="/market/mypage" />
      <main className="px-6 pt-4 pb-10">
        {session?.role !== "customer" ? (
          <LoginPrompt boxed href={`/login?next=${encodeURIComponent(`/market/mypage/trades?type=${type}`)}` as never} lead="로그인하고 " emphasis={title === "판매 관리" ? "판매 진행 상황" : "구매 진행 상황"} tail="을 확인하세요." />
        ) : (
          <>
            <ol aria-label="거래 진행 단계" className="grid grid-cols-3 gap-x-2 gap-y-4 rounded-card bg-fill px-4 py-5">
              {DEAL_STAGES.map((s, k) => (
                <li key={s} className="flex flex-col items-center gap-1 text-center text-tiny font-semibold text-ink-sub">
                  <span className="flex size-7 items-center justify-center rounded-full bg-surface text-caption font-bold text-brand-ink">{k + 1}</span>
                  {DEAL_STATUS_LABEL[s]}
                </li>
              ))}
            </ol>
            <StateView
              title="진행 중인 거래는 내 거래에서 확인해요"
              body="상담 접수부터 명의 이전까지 단계별로 보여 드립니다."
              action={<Link href="/deals" className="text-label font-bold text-brand-ink underline underline-offset-4">내 거래 보기</Link>}
            />
          </>
        )}
      </main>
    </AppScreen>
  );
}

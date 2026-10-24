"use client";

import Link from "next/link";
import { MARKET_ITEMS } from "@/lib/mock/market";
import { useFavorites } from "./favorites";
import { ItemRow } from "./item-row";
import { StateView } from "./ui";

/** 관심 회원권 목록(목업: 이 브라우저에 저장한 하트) */
export function FavoriteList() {
  const { ids } = useFavorites();
  const items = MARKET_ITEMS.filter((i) => ids.includes(i.id));
  if (!items.length) {
    return (
      <StateView
        title="관심 회원권이 없어요"
        body="회원권 정보에서 하트를 누르면 시세 변동을 여기서 모아 볼 수 있어요."
        action={<Link href="/market/search/results" className="text-label font-bold text-brand-ink underline underline-offset-4">회원권 둘러보기</Link>}
      />
    );
  }
  return <ul className="divide-y divide-line px-6">{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>;
}

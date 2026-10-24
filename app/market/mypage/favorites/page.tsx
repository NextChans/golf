import type { Metadata } from "next";
import { FavoriteList } from "@/components/market/favorite-list";
import { AppScreen, TopBar } from "@/components/market/ui";

export const metadata: Metadata = { title: "관심 회원권" };

export default function FavoritesPage() {
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="관심 회원권" back="/market/mypage" />
      <main className="pb-10"><FavoriteList /></main>
    </AppScreen>
  );
}

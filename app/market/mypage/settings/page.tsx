import type { Metadata } from "next";
import { SettingsForm } from "@/components/market/settings-form";
import { AppScreen, Divider, MenuGroup, MenuRow, TopBar } from "@/components/market/ui";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return (
    <AppScreen withTabBar={false}>
      <TopBar title="설정" back="/market/mypage" />
      <main className="pb-10">
        <h2 className="px-6 pt-4 pb-1 text-caption font-bold text-ink-mute">알림</h2>
        <SettingsForm />
        <Divider />
        <MenuGroup label="약관">
          <MenuRow href="/market/notices/fee">수수료·이용약관 안내</MenuRow>
        </MenuGroup>
        <div className="px-6 pt-4">
          <form action="/auth/signout" method="post">
            <button type="submit" className="pressable text-caption font-semibold text-ink-mute underline underline-offset-4">로그아웃</button>
          </form>
        </div>
      </main>
    </AppScreen>
  );
}

import { TabBar } from "@/components/market/tab-bar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}

import { FloatingInquiry } from "@/components/market/floating-inquiry";
import { TabBar } from "@/components/market/tab-bar";

/** 탭 바 화면(나의 회원권·마이페이지)에 "상담 문의" 플로팅을 함께 둔다(D-89). 마이페이지 하위 화면은 이 레이아웃 밖이라 나오지 않는다 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FloatingInquiry position="tab" />
      <TabBar />
    </>
  );
}

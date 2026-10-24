import { AppFontPreload } from "@/components/market/font-preload";

/**
 * 회원권 앱 공통 껍데기(D-80·D-86): 앱 폰트 preload + "미리보기" 띠.
 * `app/market/layout.tsx`와 루트 홈(`app/page.tsx`, D-87)이 함께 쓴다(레이아웃은 파일 위치로만 적용되므로).
 * 모든 화면이 목업 데이터를 쓰는 동안 상단에 안내 띠를 둔다.
 */
export function MarketShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppFontPreload />
      <p className="bg-ink py-1 text-center font-app text-tiny font-medium text-surface">미리보기 · 시세와 매물은 예시 데이터입니다</p>
      {children}
    </>
  );
}

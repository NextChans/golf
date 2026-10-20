// 목록만 스켈레톤을 둔다. 필터는 일반 GET 폼(전체 이동)이라 D-62(제자리 전환 멈춤)와 무관하다.
// 모임 상세([id])는 액션 후 제자리 갱신이 있어 loading.tsx를 두지 않는다(D-62).
export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중</span>
      <div className="mx-auto max-w-[1024px] space-y-3 px-4 pt-[124px] pb-10 md:pt-[152px] md:pb-14">
        <div className="h-9 w-40 animate-pulse rounded-tile bg-section md:h-11" />
        <div className="h-6 w-72 max-w-full animate-pulse rounded-tile bg-section" />
        <div className="grid grid-cols-2 gap-2.5 pt-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-section last:col-span-2 md:last:col-span-1" />
          ))}
        </div>
      </div>
      <div className="bg-section py-10 md:py-16">
        <div className="mx-auto grid max-w-[1024px] gap-3 px-4 md:grid-cols-2 md:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-tile bg-background/70" />
          ))}
        </div>
      </div>
    </main>
  );
}

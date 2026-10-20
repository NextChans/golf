export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중</span>
      <div className="mx-auto max-w-[1024px] space-y-3 px-4 pt-[124px] pb-10 md:pt-[152px] md:pb-14">
        <div className="h-9 w-40 animate-pulse rounded-tile bg-section md:h-11" />
        <div className="h-6 w-72 max-w-full animate-pulse rounded-tile bg-section" />
      </div>
      <div className="bg-section py-10 md:py-16">
        <div className="mx-auto grid max-w-[1024px] gap-3 px-4 md:grid-cols-2 md:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-tile bg-background/70" />
          ))}
        </div>
      </div>
    </main>
  );
}

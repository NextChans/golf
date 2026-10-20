export default function Loading() {
  return (
    <main className="mx-auto max-w-[560px] px-4 pt-[148px] pb-16 md:pt-[180px]" aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중</span>
      <div className="mx-auto mb-12 h-10 w-44 animate-pulse rounded-tile bg-section" />
      <div className="space-y-10">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-7 w-48 animate-pulse rounded-tile bg-section" />
            <div className="h-14 animate-pulse rounded-tile bg-section" />
          </div>
        ))}
      </div>
    </main>
  );
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <span className="sr-only">불러오는 중</span>
      <div className="space-y-3">
        <div className="h-9 w-40 animate-pulse rounded-tile bg-section" />
        <div className="h-6 w-72 max-w-full animate-pulse rounded-tile bg-section" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-tile bg-section" />
        ))}
      </div>
    </div>
  );
}

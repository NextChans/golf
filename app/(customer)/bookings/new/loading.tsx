export default function Loading() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-20" aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
      ))}
    </main>
  );
}

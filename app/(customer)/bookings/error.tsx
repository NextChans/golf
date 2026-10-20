"use client";

import { Button } from "@/components/ui/button";

export default function BookingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-20">
      <h1 className="text-xl font-bold">화면을 불러오지 못했습니다</h1>
      <p className="text-sm text-muted-foreground">일시적인 오류일 수 있습니다. 다시 시도해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}

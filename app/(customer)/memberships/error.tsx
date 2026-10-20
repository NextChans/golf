"use client";

import { Tile } from "@/components/site/section";
import { Button } from "@/components/ui/button";

export default function MembershipsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="bg-section py-16 md:py-24">
      <div className="mx-auto max-w-[1024px] px-4">
        <Tile className="bg-card px-6 py-14 text-center md:py-20">
          <h1 className="text-eyebrow font-semibold tracking-tight md:text-title">화면을 불러오지 못했습니다</h1>
          <p role="alert" className="mx-auto mt-3 max-w-[420px] text-body text-destructive">
            일시적인 오류일 수 있습니다. 다시 시도해 주세요.
          </p>
          <Button onClick={reset} className="mt-8">다시 시도</Button>
        </Tile>
      </div>
    </main>
  );
}

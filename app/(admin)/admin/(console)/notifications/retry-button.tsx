"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryNotification } from "./actions";

export function RetryButton({ id }: { id: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
        setError(null);
        const r = await retryNotification({ id });
        if (!r.ok) setError(r.error.message);
      })}>
        {pending ? "처리 중…" : "다시 보내기"}
      </Button>
      {error && <p role="alert" className="text-micro text-destructive">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelBooking } from "../actions";

export function CancelBookingButton({ requestId, version }: { requestId: string; version: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant="ghost" className="w-full text-destructive" disabled={pending}
        onClick={() => {
          if (!confirm("요청을 취소할까요? 취소 후에는 되돌릴 수 없습니다.")) return;
          setError(null);
          start(async () => {
            const r = await cancelBooking({ requestId, expectedVersion: version, reason: null });
            if (!r.ok) setError(r.error.message);
            router.refresh();
          });
        }}
      >
        {pending ? "취소 중…" : "요청 취소"}
      </Button>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}

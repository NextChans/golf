"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { copyText } from "../share";

/** 주소(밑줄) + 복사 아이콘. 복사 결과는 role="status"로 알린다. 클립보드가 막히면 안내 문구 */
export function CopyAddress({ address }: { address: string }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const ok = await copyText(address);
    setMessage(ok ? "주소를 복사했어요" : "복사하지 못했어요. 주소를 길게 눌러 복사해 주세요");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <p className="text-subhead font-bold text-ink-sub underline underline-offset-4">{address}</p>
        <button type="button" onClick={copy} aria-label="주소 복사" className="pressable flex size-11 items-center justify-center text-ink-mute">
          <Copy aria-hidden className="size-5" />
        </button>
      </div>
      <p role="status" className="min-h-5 text-caption font-semibold text-brand-ink">{message}</p>
    </div>
  );
}

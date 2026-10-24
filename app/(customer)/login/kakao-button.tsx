"use client";

import { useFormStatus } from "react-dom";

// 카카오 로그인 버튼 가이드(노란 배경 #FEE500, 검은 심볼·텍스트)를 따른다
export function KakaoButton({ label = "카카오로 시작하기", className }: { label?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`pressable flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] text-body font-semibold text-black/85 outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-60 ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
      </svg>
      {pending ? "카카오로 이동 중…" : label}
    </button>
  );
}

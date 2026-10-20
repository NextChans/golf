"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { adminSignIn, type LoginState } from "./actions";

export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<LoginState, FormData>(adminSignIn, {});
  useEffect(() => {
    if (state.next) {
      router.replace(state.next as never);
      router.refresh();
    }
  }, [state.next, router]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <FloatingInput id="email" label="이메일" name="email" type="email" autoComplete="username" required />
      <FloatingInput id="password" label="비밀번호" name="password" type="password" autoComplete="current-password" required />
      {state.error && <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="mt-3" disabled={pending || !!state.next}>{pending || state.next ? "로그인 중…" : "로그인"}</Button>
    </form>
  );
}

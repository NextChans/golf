"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending || !!state.next}>{pending || state.next ? "로그인 중…" : "로그인"}</Button>
    </form>
  );
}

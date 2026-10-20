"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { changeInitialPassword } from "./actions";

export function PasswordForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await changeInitialPassword({ password, confirm });
          if (!r.ok) return setError(r.error.message);
          router.replace("/admin/mfa");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <FloatingInput
          id="new-password" label="새 비밀번호" type="password" autoComplete="new-password" aria-describedby="new-password-hint"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <p id="new-password-hint" className="px-1 text-micro text-muted-foreground">12자 이상, 영문과 숫자를 포함</p>
      </div>
      <FloatingInput
        id="confirm-password" label="새 비밀번호 확인" type="password" autoComplete="new-password"
        value={confirm} onChange={(e) => setConfirm(e.target.value)} required
      />
      {error && <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="mt-3" disabled={pending}>{pending ? "변경 중…" : "비밀번호 변경"}</Button>
    </form>
  );
}

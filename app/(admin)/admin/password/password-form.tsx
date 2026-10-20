"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeInitialPassword } from "./actions";

export function PasswordForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form
      className="flex flex-col gap-4"
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
        <Label htmlFor="new-password">새 비밀번호</Label>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="text-xs text-muted-foreground">12자 이상, 영문과 숫자를 포함</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "변경 중…" : "비밀번호 변경"}</Button>
    </form>
  );
}

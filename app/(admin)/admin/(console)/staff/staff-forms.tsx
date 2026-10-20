"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { createStaff, setStaffRole } from "./actions";

export function CreateStaffForm() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setIssued(null);
          start(async () => {
            const r = await createStaff({ email, role });
            if (!r.ok) return setError(r.error.message);
            setIssued(r.data);
            setEmail("");
          });
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <FloatingInput
            id="staff-email" label="이메일" type="email" autoComplete="off" required className="flex-1"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative sm:w-44">
            <select
              id="staff-role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "owner")}
              className="peer h-14 w-full appearance-none rounded-xl border border-input bg-card px-4 pt-5 pb-1.5 text-body outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <option value="admin">운영자</option>
              <option value="owner">최고관리자</option>
            </select>
            <label htmlFor="staff-role" className="pointer-events-none absolute top-2 left-4 text-micro text-muted-foreground">역할</label>
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rotate-90 text-muted-foreground">›</span>
          </div>
        </div>
        {error && <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "발급 중…" : "계정 발급"}</Button>
        </div>
      </form>
      {issued && (
        <div role="status" className="rounded-tile bg-secondary px-5 py-4 text-small text-secondary-foreground">
          <p className="font-semibold">{issued.email} 계정을 발급했습니다</p>
          <p className="mt-2">
            임시 비밀번호(지금만 표시됩니다):{" "}
            <code data-testid="temp-password" className="rounded-md bg-background px-1.5 py-0.5 font-mono text-foreground select-all">{issued.tempPassword}</code>
          </p>
          <p className="mt-2 text-muted-foreground">첫 로그인 시 비밀번호 변경과 OTP 등록을 진행합니다. 안전한 경로로 전달해 주세요.</p>
        </div>
      )}
    </div>
  );
}

export function RevokeStaffButton({ userId, email }: { userId: string; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm" variant="outline" className="relative after:absolute after:inset-x-0 after:-inset-y-1" disabled={pending}
        onClick={() => {
          if (!confirm(`${email}의 운영자 권한을 회수할까요? 즉시 로그아웃됩니다.`)) return;
          setError(null);
          start(async () => {
            const r = await setStaffRole({ userId, role: null });
            if (!r.ok) setError(r.error.message);
          });
        }}
      >
        권한 회수
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

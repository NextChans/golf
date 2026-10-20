"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createStaff, setStaffRole } from "./actions";

export function CreateStaffForm() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
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
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="staff-email">이메일</Label>
          <Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-role">역할</Label>
          <select
            id="staff-role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "owner")}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-36"
          >
            <option value="admin">운영자</option>
            <option value="owner">최고관리자</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "발급 중…" : "계정 발급"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {issued && (
        <Alert>
          <AlertTitle>{issued.email} 계정을 발급했습니다</AlertTitle>
          <AlertDescription>
            임시 비밀번호(지금만 표시됩니다): <code data-testid="temp-password" className="font-mono">{issued.tempPassword}</code>
            <br />첫 로그인 시 비밀번호 변경과 OTP 등록을 진행합니다. 안전한 경로로 전달해 주세요.
          </AlertDescription>
        </Alert>
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
        size="sm" variant="outline" disabled={pending}
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

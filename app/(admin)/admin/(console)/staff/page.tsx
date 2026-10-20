import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/guards";
import { formatKst } from "@/lib/format/kst";
import { CreateStaffForm, RevokeStaffButton } from "./staff-forms";

export const metadata: Metadata = { title: "운영자 관리", robots: { index: false } };

export default async function StaffPage() {
  const session = await requireOwner();
  const supabase = await createClient();
  const { data: staff, error } = await supabase.rpc("list_staff");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">운영자 관리</h1>
      <Card>
        <CardHeader><CardTitle>계정 발급</CardTitle></CardHeader>
        <CardContent><CreateStaffForm /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>운영자 목록</CardTitle></CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-destructive">목록을 불러오지 못했습니다.</p>
          ) : !staff?.length ? (
            <p className="text-sm text-muted-foreground">등록된 운영자가 없습니다.</p>
          ) : (
            <ul className="divide-y">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{s.email}</p>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge variant={s.role === "owner" ? "default" : "secondary"}>{s.role === "owner" ? "최고관리자" : "운영자"}</Badge>
                      <Badge variant={s.mfa_enabled ? "secondary" : "destructive"}>{s.mfa_enabled ? "OTP 등록" : "OTP 미등록"}</Badge>
                      {s.password_change_required && <Badge variant="outline">임시 비밀번호</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">최근 로그인 {formatKst(s.last_sign_in_at)}</p>
                  </div>
                  {s.id !== session.userId && <RevokeStaffButton userId={s.id} email={s.email} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

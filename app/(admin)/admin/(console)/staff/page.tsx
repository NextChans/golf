import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
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
    <div className="space-y-10">
      <div>
        <h1 className="text-title tracking-tight">운영자 관리</h1>
        <p className="mt-2 text-body text-muted-foreground">운영자 계정을 발급하고 권한을 관리합니다.</p>
      </div>
      <section aria-labelledby="create-staff-title" className="space-y-4">
        <h2 id="create-staff-title" className="text-eyebrow tracking-tight">계정 발급</h2>
        <Tile className="p-5 md:p-7"><CreateStaffForm /></Tile>
      </section>
      <section aria-labelledby="staff-list-title" className="space-y-4">
        <h2 id="staff-list-title" className="text-eyebrow tracking-tight">운영자 목록</h2>
        {error ? (
          <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">목록을 불러오지 못했습니다.</p>
        ) : !staff?.length ? (
          <Tile className="p-6 md:p-8"><p className="text-body text-muted-foreground">등록된 운영자가 없습니다.</p></Tile>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 space-y-1.5">
                  <p className="truncate text-body font-semibold">{s.email}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={s.role === "owner" ? "default" : "secondary"}>{s.role === "owner" ? "최고관리자" : "운영자"}</Badge>
                    <Badge variant={s.mfa_enabled ? "secondary" : "destructive"}>{s.mfa_enabled ? "OTP 등록" : "OTP 미등록"}</Badge>
                    {s.password_change_required && <Badge variant="outline">임시 비밀번호</Badge>}
                  </div>
                  <p className="text-micro text-muted-foreground">최근 로그인 {formatKst(s.last_sign_in_at)}</p>
                </div>
                {s.id !== session.userId && <RevokeStaffButton userId={s.id} email={s.email} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

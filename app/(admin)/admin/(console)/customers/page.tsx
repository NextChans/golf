import type { Metadata, Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { Tile } from "@/components/site/section";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { parseCustomerQuery } from "@/lib/domain/crm/schema";
import { maskPhone } from "@/lib/domain/phone";
import { formatKst } from "@/lib/format/kst";

export const metadata: Metadata = { title: "고객", robots: { index: false } };

const LIMIT = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireStaff();
  const { q } = await searchParams;
  const rawQ = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const query = parseCustomerQuery(q);

  let customers: { id: string; display_name: string | null; phone: string | null; created_at: string; deleted_at: string | null }[] = [];
  let failed = false;
  if (query.kind !== "invalid_phone") {
    const supabase = await createClient();
    // 고객만: 온보딩을 마친 profiles(운영자 profiles는 onboarded_at이 null)
    let builder = supabase
      .from("profiles")
      .select("id, display_name, phone, created_at, deleted_at")
      .not("onboarded_at", "is", null);
    if (query.kind === "phone") builder = builder.eq("phone", query.e164);
    if (query.kind === "name") builder = builder.ilike("display_name", query.pattern);
    const { data, error } = await builder.order("created_at", { ascending: false }).limit(LIMIT);
    failed = !!error;
    customers = data ?? [];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title tracking-tight">고객</h1>
        <p className="mt-2 text-body text-muted-foreground">이름 또는 휴대폰 번호로 고객을 찾고 통화 메모를 남깁니다.</p>
      </div>

      <form role="search" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <FloatingInput
          id="customer-q" name="q" label="이름 또는 휴대폰 번호" defaultValue={rawQ}
          autoComplete="off" inputMode="search" maxLength={50} className="flex-1"
        />
        <Button type="submit" className="h-14 w-full sm:w-auto">검색</Button>
      </form>

      <section aria-labelledby="customer-list-title" className="space-y-3">
        <h2 id="customer-list-title" className="text-eyebrow tracking-tight">
          {query.kind === "none" ? "최근 가입 고객" : "검색 결과"}
          {!failed && query.kind !== "invalid_phone" && (
            <span className="ml-2 text-small font-normal text-muted-foreground">{customers.length}{customers.length === LIMIT ? "명+" : "명"}</span>
          )}
        </h2>
        {query.kind === "invalid_phone" ? (
          <Tile className="p-6 md:p-8">
            <p className="text-body text-muted-foreground">휴대폰 번호는 전체(예: 010-1234-5678)를 입력해 주세요.</p>
          </Tile>
        ) : failed ? (
          <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">고객 목록을 불러오지 못했습니다.</p>
        ) : !customers.length ? (
          <Tile className="p-6 md:p-8">
            <p className="text-body text-muted-foreground">{query.kind === "none" ? "아직 가입한 고객이 없습니다." : "검색 결과가 없습니다."}</p>
          </Tile>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/customers/${c.id}` as Route}
                  className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-section"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 truncate text-body font-semibold">
                      {c.display_name ?? "(이름 없음)"}
                      {c.deleted_at && <Badge variant="outline">탈퇴</Badge>}
                    </p>
                    <p className="text-small text-muted-foreground tabular-nums">
                      <span data-testid="customer-phone">{maskPhone(c.phone)}</span>
                      <span aria-hidden> · </span>
                      가입 {formatKst(c.created_at)}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted-foreground">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

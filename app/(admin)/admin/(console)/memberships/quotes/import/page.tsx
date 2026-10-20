import type { Metadata } from "next";
import { MoreLink, Tile } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayKst } from "@/lib/domain/booking/schema";
import { QUOTE_CSV_HEADER, type QuoteProductRef } from "@/lib/domain/membership/quote-csv";
import { QuoteImportForm } from "./import-form";

export const metadata: Metadata = { title: "시세 일괄 입력", robots: { index: false } };

// loading.tsx·<Suspense>를 두지 않는다(D-62). 로딩 표시는 버튼 pending 상태가 맡는다.

type ProductRow = { id: string; kind: string; golf_course: { name: string } | null };

export default async function QuoteImportPage() {
  // 권한은 (console) 레이아웃의 requireStaff가 검사한다. 운영자는 판매 중지 상품도 읽는다(RLS).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_products")
    .select("id, kind, golf_course:golf_courses(name)")
    .order("created_at", { ascending: true });
  const products: QuoteProductRef[] = ((data ?? []) as unknown as ProductRow[])
    .filter((p) => p.golf_course)
    .map((p) => ({ id: p.id, courseName: p.golf_course!.name, kind: p.kind }));

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <MoreLink href="/admin/memberships?tab=products" className="text-small">상품·시세 목록</MoreLink>
      <div>
        <h1 className="text-title tracking-tight">시세 일괄 입력</h1>
        <p className="mt-2 text-body text-muted-foreground">여러 상품의 시세를 CSV로 한 번에 반영합니다.</p>
      </div>

      <Tile className="space-y-2 p-5 text-small md:p-7">
        <p className="font-semibold">입력 형식</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            첫 줄은 머리글 <code className="rounded bg-background px-1.5 py-0.5 text-foreground">{QUOTE_CSV_HEADER.join(",")}</code>
          </li>
          <li>골프장·종류는 등록된 상품 이름 그대로, 기준일은 2026-10-20 형식(오늘 이후 불가)</li>
          <li>금액은 원 단위 숫자. 매수·매도 중 하나는 비워도 됩니다. 쉼표를 넣으려면 &quot;325,000,000&quot;처럼 따옴표로 감쌉니다</li>
          <li>같은 상품·기준일 시세가 이미 있으면 덮어씁니다. 한 번에 500행까지, 한 행이라도 오류면 반영하지 않습니다</li>
          <li>Excel에서는 &apos;CSV UTF-8&apos;로 저장하거나, 셀을 복사해 그대로 붙여넣어도 됩니다</li>
        </ul>
      </Tile>

      {error ? (
        <Tile className="p-6 md:p-8">
          <p role="alert" className="text-body text-destructive">상품 목록을 불러오지 못했습니다.</p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href="/admin/memberships/quotes/import">다시 시도</Link>
          </Button>
        </Tile>
      ) : products.length === 0 ? (
        <Tile className="p-6 text-center md:p-10">
          <p className="text-eyebrow tracking-tight">등록된 상품이 없습니다</p>
          <p className="mt-2 text-small text-muted-foreground">상품을 먼저 추가해야 시세를 입력할 수 있습니다.</p>
          <Button asChild className="mt-6"><Link href="/admin/memberships/products/new">상품 추가</Link></Button>
        </Tile>
      ) : (
        <QuoteImportForm products={products} today={todayKst()} />
      )}
    </div>
  );
}

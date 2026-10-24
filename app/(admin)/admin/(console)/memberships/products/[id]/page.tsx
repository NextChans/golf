import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MoreLink, Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format/money";
import { todayKst } from "@/lib/format/kst";
import { formatKst, formatKstDate } from "@/lib/format/kst";
import { loadCourseOptions } from "../../options";
import { ProductForm } from "../../product-form";
import { QuoteForm } from "../../quote-form";

export const metadata: Metadata = { title: "회원권 상품 수정", robots: { index: false } };

const QUOTE_LIMIT = 30;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // uuid가 아니면 DB까지 가지 않는다(22P02를 404로)
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [productRes, quotesRes, courses] = await Promise.all([
    supabase
      .from("membership_products")
      .select("id, golf_course_id, kind, name, is_active, updated_at, golf_course:golf_courses(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("membership_quotes")
      .select("id, quoted_on, buy_price, sell_price, created_at")
      .eq("product_id", id)
      .order("quoted_on", { ascending: false })
      .limit(QUOTE_LIMIT),
    loadCourseOptions(supabase),
  ]);
  if (productRes.error) throw new Error("membership_product_load_failed");
  const product = productRes.data;
  if (!product) notFound();
  const quotes = quotesRes.data ?? [];

  return (
    <div className="mx-auto max-w-[560px] space-y-8">
      <MoreLink href="/admin/memberships?tab=products" className="text-small">상품 목록</MoreLink>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-title tracking-tight">회원권 상품 수정</h1>
          <Badge variant={product.is_active ? "default" : "secondary"}>{product.is_active ? "판매 중" : "판매 중지"}</Badge>
        </div>
        <p className="text-small text-muted-foreground">{product.golf_course?.name} {product.kind}</p>
        <p className="text-micro text-muted-foreground">최근 수정 {formatKst(product.updated_at)}</p>
      </div>
      <Tile className="p-5 md:p-7"><ProductForm product={product} courses={courses} /></Tile>

      <section aria-labelledby="quotes-heading" className="space-y-4">
        <div>
          <h2 id="quotes-heading" className="text-eyebrow font-semibold tracking-tight">시세</h2>
          <p className="mt-1 text-small text-muted-foreground">기준일별 매수·매도 시세입니다. 고객 시세 화면에 최신 값이 표시됩니다.</p>
        </div>
        <Tile className="p-5 md:p-7"><QuoteForm productId={product.id} today={todayKst()} /></Tile>
        {quotesRes.error ? (
          <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">시세 기록을 불러오지 못했습니다. 새로고침해 주세요.</p>
        ) : quotes.length === 0 ? (
          <p className="px-1 text-small text-muted-foreground">아직 입력된 시세가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-tile border border-border/70 bg-card">
            <table className="w-full text-small">
              <caption className="sr-only">최근 시세 {quotes.length}건</caption>
              <thead className="text-micro text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="px-4 py-3 text-left font-medium">기준일</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">매수 시세</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">매도 시세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 tabular-nums">
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatKstDate(q.quoted_on)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatWon(q.buy_price)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatWon(q.sell_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

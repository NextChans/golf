import type { Metadata } from "next";
import { MoreLink, Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { loadCourseOptions } from "../../options";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "회원권 상품 추가", robots: { index: false } };

export default async function NewProductPage() {
  const supabase = await createClient();
  const courses = await loadCourseOptions(supabase);
  return (
    <div className="mx-auto max-w-[560px] space-y-6">
      <MoreLink href="/admin/memberships?tab=products" className="text-small">상품 목록</MoreLink>
      <h1 className="text-title tracking-tight">회원권 상품 추가</h1>
      <Tile className="p-5 md:p-7"><ProductForm courses={courses} /></Tile>
    </div>
  );
}

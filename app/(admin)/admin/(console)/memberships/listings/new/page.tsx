import type { Metadata } from "next";
import Link from "next/link";
import { MoreLink, Tile } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadProductOptions } from "../../options";
import { ListingForm } from "../../listing-form";

export const metadata: Metadata = { title: "매물 등록", robots: { index: false } };

export default async function NewListingPage() {
  const supabase = await createClient();
  const products = await loadProductOptions(supabase);
  return (
    <div className="mx-auto max-w-[560px] space-y-6">
      <MoreLink href="/admin/memberships" className="text-small">매물 목록</MoreLink>
      <h1 className="text-title tracking-tight">매물 등록</h1>
      {products.length === 0 ? (
        <Tile className="p-6 text-center md:p-10">
          <p className="text-eyebrow tracking-tight">먼저 상품을 추가해 주세요</p>
          <p className="mt-2 text-small text-muted-foreground">매물은 골프장별 회원권 상품에 속합니다.</p>
          <Button asChild className="mt-6"><Link href="/admin/memberships/products/new">상품 추가</Link></Button>
        </Tile>
      ) : (
        <Tile className="p-5 md:p-7"><ListingForm products={products} /></Tile>
      )}
    </div>
  );
}

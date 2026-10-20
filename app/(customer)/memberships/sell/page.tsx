import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { REGION_LABEL } from "@/lib/domain/course/schema";
import { SellForm, type ProductGroup } from "./sell-form";

export const metadata: Metadata = { title: "매도 상담" };

export default async function SellInquiryPage({ searchParams }: { searchParams: Promise<{ product?: string | string[] }> }) {
  const session = await requireCustomer();
  const { product } = await searchParams;
  const supabase = await createClient();
  const [{ data: products, error }, { data: profile }] = await Promise.all([
    // 활성 상품만(RLS도 비활성 상품을 숨긴다). 골프장명은 FK embedding으로 한 번에.
    supabase
      .from("membership_products")
      .select("id, kind, name, golf_courses!inner(id, name, region)")
      .eq("is_active", true)
      .order("name"),
    supabase.from("profiles").select("phone").eq("id", session.userId).maybeSingle(),
  ]);
  // 연락처가 없으면 상담을 받을 수 없다(D-48, DB 트리거가 최종 차단)
  const needsContact = !profile?.phone;

  // 골프장별 묶음(optgroup). 골프장 이름순 → 종류순
  const groups = new Map<string, ProductGroup>();
  for (const p of products ?? []) {
    const c = p.golf_courses;
    const g = groups.get(c.id) ?? { courseName: c.name, regionLabel: REGION_LABEL[c.region], products: [] };
    g.products.push({ id: p.id, kind: p.kind });
    groups.set(c.id, g);
  }
  const productGroups = [...groups.values()]
    .sort((a, b) => a.courseName.localeCompare(b.courseName, "ko"))
    .map((g) => ({ ...g, products: g.products.sort((a, b) => a.kind.localeCompare(b.kind, "ko")) }));
  const initialProduct = typeof product === "string" && productGroups.some((g) => g.products.some((p) => p.id === product))
    ? product
    : "";

  return (
    <>
      <GlobalNav />
      <LocalNav title="매도 상담" />
      <main className="mx-auto max-w-[560px] px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mb-10 text-center md:mb-14">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">회원권 매도 상담</h1>
          <p className="mt-3 text-eyebrow text-muted-foreground">
            보유하신 회원권과 희망 가격을 알려주시면 담당자가 시세를 확인해 연락드립니다.
          </p>
        </div>
        {needsContact ? (
          <Tile className="text-center" data-testid="contact-required">
            <p className="text-eyebrow font-semibold">연락처를 먼저 입력해 주세요</p>
            <p className="mt-2 text-body text-muted-foreground">담당자가 상담 전화를 드려야 해서 휴대폰 번호가 필요합니다.</p>
            <Button asChild className="mt-6"><Link href="/me#contact">연락처 입력하기</Link></Button>
          </Tile>
        ) : error ? (
          <Tile className="text-center">
            <p role="alert" className="text-body text-destructive">회원권 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>
          </Tile>
        ) : productGroups.length === 0 ? (
          <Tile className="text-center">
            <p className="text-eyebrow font-semibold">상담 가능한 회원권이 아직 없습니다</p>
            <p className="mt-2 text-body text-muted-foreground">취급 골프장이 추가되면 신청할 수 있습니다.</p>
          </Tile>
        ) : (
          // 멱등키는 렌더마다 새로 발급(D-10)
          <SellForm idempotencyKey={randomUUID()} groups={productGroups} initialProduct={initialProduct} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

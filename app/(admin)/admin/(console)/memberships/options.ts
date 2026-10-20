import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CourseOption } from "./product-form";
import type { ProductOption } from "./listing-form";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 상품 폼의 골프장 선택지(운영 중 먼저) */
export async function loadCourseOptions(supabase: Supabase): Promise<CourseOption[]> {
  const { data, error } = await supabase
    .from("golf_courses")
    .select("id, name, is_active")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw new Error("golf_course_options_load_failed");
  return data ?? [];
}

/** 매물 폼의 상품 선택지(판매 중 먼저, "골프장 종류 — 상품명") */
export async function loadProductOptions(supabase: Supabase): Promise<ProductOption[]> {
  const { data, error } = await supabase
    .from("membership_products")
    .select("id, kind, name, is_active, golf_course:golf_courses(name)")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw new Error("membership_product_options_load_failed");
  return (data ?? []).map((p) => ({
    id: p.id,
    is_active: p.is_active,
    label: `${p.golf_course?.name ?? "골프장"} ${p.kind} — ${p.name}`,
  }));
}

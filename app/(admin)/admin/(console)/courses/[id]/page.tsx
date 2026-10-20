import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MoreLink, Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/format/kst";
import { CourseForm } from "../course-form";

export const metadata: Metadata = { title: "골프장 수정", robots: { index: false } };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // uuid가 아니면 DB까지 가지 않는다(22P02를 404로)
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("golf_courses")
    .select("id, name, region, address, weekday_green_fee, weekend_green_fee, cancellation_policy, contact_phone, is_active, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("golf_course_load_failed");
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-[560px] space-y-6">
      <MoreLink href="/admin/courses" className="text-small">골프장 목록</MoreLink>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-title tracking-tight">골프장 수정</h1>
          <Badge variant={course.is_active ? "default" : "secondary"}>{course.is_active ? "운영" : "중지"}</Badge>
        </div>
        <p className="text-micro text-muted-foreground">최근 수정 {formatKst(course.updated_at)}</p>
      </div>
      <Tile className="p-5 md:p-7"><CourseForm course={course} /></Tile>
    </div>
  );
}

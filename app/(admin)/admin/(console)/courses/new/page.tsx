import type { Metadata } from "next";
import { MoreLink, Tile } from "@/components/site/section";
import { CourseForm } from "../course-form";

export const metadata: Metadata = { title: "골프장 추가", robots: { index: false } };

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-[560px] space-y-6">
      <MoreLink href="/admin/courses" className="text-small">골프장 목록</MoreLink>
      <h1 className="text-title tracking-tight">골프장 추가</h1>
      <Tile className="p-5 md:p-7"><CourseForm /></Tile>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format/money";
import { REGION_LABEL } from "@/lib/domain/course/schema";

export const metadata: Metadata = { title: "골프장 관리", robots: { index: false } };

export default async function CoursesPage() {
  // 권한은 (console) 레이아웃의 requireStaff가 검사한다. RLS상 운영자는 중지된 골프장도 본다.
  const supabase = await createClient();
  const { data: courses, error } = await supabase
    .from("golf_courses")
    .select("id, name, region, weekday_green_fee, weekend_green_fee, is_active")
    .order("is_active", { ascending: false })
    .order("name");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title tracking-tight">골프장 관리</h1>
          <p className="mt-2 text-body text-muted-foreground">회원권 상품과 모임 장소에 쓰는 골프장과 기본 그린피를 관리합니다.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/courses/new">골프장 추가</Link>
        </Button>
      </div>

      {error ? (
        <Tile className="p-6 md:p-8">
          <p role="alert" className="text-body text-destructive">목록을 불러오지 못했습니다.</p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href="/admin/courses">다시 시도</Link>
          </Button>
        </Tile>
      ) : !courses?.length ? (
        <Tile className="p-6 text-center md:p-10">
          <p className="text-eyebrow tracking-tight">등록된 골프장이 없습니다</p>
          <p className="mt-2 text-small text-muted-foreground">골프장을 추가하면 회원권 상품과 모임 장소에서 선택할 수 있습니다.</p>
          <Button asChild className="mt-6">
            <Link href="/admin/courses/new">골프장 추가</Link>
          </Button>
        </Tile>
      ) : (
        <ul aria-label="골프장 목록" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/courses/${c.id}`}
                className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-section/60"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-body font-semibold">{c.name}</p>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "운영" : "중지"}</Badge>
                  </div>
                  <p className="text-small text-muted-foreground">
                    {REGION_LABEL[c.region]}
                    <span aria-hidden> · </span>
                    <span className="tabular-nums">주중 {formatWon(c.weekday_green_fee)}</span>
                    <span aria-hidden> · </span>
                    <span className="tabular-nums">주말 {formatWon(c.weekend_green_fee)}</span>
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

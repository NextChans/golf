import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { requireCustomer } from "@/lib/auth/guards";
import { isoToKstLocal } from "@/lib/domain/booking/admin";
import { REGION_LABEL } from "@/lib/domain/course/schema";
import { isGroupManager } from "@/lib/domain/community/labels";
import { loadGroup, UUID_RE } from "../../../data";
import { MeetingForm } from "./meeting-form";

export const metadata: Metadata = { title: "정모 만들기" };

export default async function NewMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, group: g, me } = await loadGroup(id);
  if (!g) notFound();
  // 모임장·운영진만(DB의 create_meeting이 최종 판단)
  if (me?.status !== "active" || !isGroupManager(me.role)) forbidden();

  const { data: courses, error } = await supabase
    .from("golf_courses")
    .select("id, name, region")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <GlobalNav />
      <LocalNav title="정모 만들기" />
      <main className="mx-auto max-w-[560px] px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mb-10 text-center md:mb-14">
          <Link href={`/groups/${g.id}`} className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4">
            <span aria-hidden className="text-[1.1em] leading-none">‹</span>{g.name}
          </Link>
          <h1 className="mt-2 text-title font-semibold tracking-tight md:text-headline">정모 만들기</h1>
          <p className="mt-3 text-eyebrow text-muted-foreground">정모를 만들면 멤버에게 알림이 갑니다.</p>
        </div>
        {g.status !== "active" ? (
          <Tile className="text-center">
            <p className="text-body text-muted-foreground">공개된 모임에서만 정모를 만들 수 있습니다.</p>
          </Tile>
        ) : error ? (
          <Tile className="text-center">
            <p role="alert" className="text-body text-destructive">골프장 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>
          </Tile>
        ) : (
          <MeetingForm
            groupId={g.id}
            minLocal={isoToKstLocal(new Date().toISOString())}
            courses={(courses ?? []).map((c) => ({ id: c.id, name: c.name, regionLabel: REGION_LABEL[c.region] }))}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

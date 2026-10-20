import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { requireCustomer } from "@/lib/auth/guards";
import { isGroupManager } from "@/lib/domain/community/labels";
import { loadGroup, UUID_RE } from "../../data";
import { GroupForm } from "../../group-form";

export const metadata: Metadata = { title: "모임 정보 수정" };

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { group: g, me } = await loadGroup(id);
  if (!g) notFound();
  // 모임장·운영진만(DB의 update_group이 최종 판단)
  if (me?.status !== "active" || !isGroupManager(me.role)) forbidden();
  const editable = g.status === "active" || g.status === "review";

  return (
    <>
      <GlobalNav />
      <LocalNav title="모임 정보 수정" />
      <main className="mx-auto max-w-[560px] px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mb-10 text-center md:mb-14">
          <Link href={`/groups/${g.id}`} className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4">
            <span aria-hidden className="text-[1.1em] leading-none">‹</span>{g.name}
          </Link>
          <h1 className="mt-2 text-title font-semibold tracking-tight md:text-headline">모임 정보 수정</h1>
        </div>
        {editable ? (
          <GroupForm
            mode="edit" groupId={g.id} version={g.version}
            initial={{
              name: g.name, type: g.type, region: g.region, description: g.description, joinPolicy: g.join_policy,
              capacity: g.capacity, openChatUrl: g.open_chat_url ?? "",
            }}
          />
        ) : (
          <Tile className="text-center">
            <p className="text-body text-muted-foreground">비공개·종료된 모임은 수정할 수 없습니다.</p>
          </Tile>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

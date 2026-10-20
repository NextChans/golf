import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import { REGION_LABEL, REGIONS } from "@/lib/domain/course/schema";
import {
  GROUP_ROLE_LABEL, GROUP_STATUS_LABEL, GROUP_TYPE_LABEL, GROUP_TYPES, JOIN_POLICY_LABEL,
} from "@/lib/domain/community/labels";
import { parseGroupFilters } from "@/lib/domain/community/schema";
import { Chevron, fieldLabelClass, selectClass } from "../fields";

export const metadata: Metadata = { title: "골프 모임" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const NEW_HREF = "/groups/new";

export default async function GroupsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseGroupFilters(await searchParams);
  const session = await getSession();
  const isCustomer = session?.role === "customer";
  const supabase = await createClient();

  // 공개 목록은 활성 모임만(RLS도 비활성 모임을 비회원에게 숨긴다). 내 모임은 내 멤버십 + 모임을 한 번에(N+1 없음).
  let query = supabase
    .from("groups")
    .select("id, name, type, region, member_count, capacity, join_policy, created_at")
    .eq("status", "active");
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.type) query = query.eq("type", filters.type);
  const [{ data: groups, error }, mineRes] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(60),
    isCustomer
      ? supabase
          .from("group_members")
          .select("role, status, created_at, groups!inner(id, name, type, region, member_count, capacity, status)")
          .eq("user_id", session.userId)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false })
      : Promise.resolve(null),
  ]);
  const mine = mineRes?.data ?? [];
  const filtered = filters.region !== null || filters.type !== null;
  const createHref = session ? NEW_HREF : `/login?next=${encodeURIComponent(NEW_HREF)}`;

  return (
    <>
      <GlobalNav />
      <LocalNav
        title="모임"
        action={<Button asChild size="sm"><Link href={createHref as never}>모임 만들기</Link></Button>}
      />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-12 pb-8 md:pt-20 md:pb-12">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">골프 모임</h1>
          <p className="mt-3 max-w-[560px] text-eyebrow text-muted-foreground">
            함께 라운딩하고 연습할 골프 친구를 찾아보세요. 정모 일정과 게시판은 멤버에게만 보입니다.
          </p>
        </div>

        {isCustomer && mine.length > 0 && (
          <section className="mx-auto max-w-[1024px] px-4 pb-10 md:pb-14" aria-labelledby="mine-title">
            <h2 id="mine-title" className="mb-4 text-eyebrow font-semibold tracking-tight">내 모임</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {mine.map((m) => (
                <li key={m.groups.id}>
                  <Link
                    href={`/groups/${m.groups.id}`}
                    className="pressable flex items-center gap-3 rounded-tile bg-section p-4 outline-none hover:bg-section/70 focus-visible:ring-4 focus-visible:ring-ring/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold">{m.groups.name}</p>
                      <p className="mt-0.5 text-small text-muted-foreground">
                        {GROUP_TYPE_LABEL[m.groups.type]} · {REGION_LABEL[m.groups.region]} · {m.status === "pending" ? "승인 대기 중" : GROUP_ROLE_LABEL[m.role]}
                      </p>
                    </div>
                    {m.groups.status !== "active" && (
                      <Badge variant="secondary" className="px-2.5 py-1 text-micro">{GROUP_STATUS_LABEL[m.groups.status]}</Badge>
                    )}
                    <span aria-hidden className="text-eyebrow text-muted-foreground">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 검색 조건: GET 폼(JS 없이도 동작, URL 공유 가능) */}
        <div className="mx-auto max-w-[1024px] px-4 pb-8 md:pb-12">
          <form method="get" action="/groups" className="grid grid-cols-2 gap-2.5 md:grid-cols-[1fr_1fr_auto] md:items-center" aria-label="모임 검색">
            <div className="relative">
              <select id="region" name="region" defaultValue={filters.region ?? ""} className={selectClass}>
                <option value="">전체 지역</option>
                {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
              </select>
              <label htmlFor="region" className={fieldLabelClass}>지역</label>
              <Chevron />
            </div>
            <div className="relative">
              <select id="type" name="type" defaultValue={filters.type ?? ""} className={selectClass}>
                <option value="">전체 유형</option>
                {GROUP_TYPES.map((t) => <option key={t} value={t}>{GROUP_TYPE_LABEL[t]}</option>)}
              </select>
              <label htmlFor="type" className={fieldLabelClass}>모임 유형</label>
              <Chevron />
            </div>
            <div className="col-span-2 flex items-center justify-center gap-4 md:col-span-1">
              <Button type="submit" className="w-full md:w-auto">검색</Button>
              {filtered && (
                <Link href="/groups" className="pressable shrink-0 text-small text-primary hover:underline underline-offset-4">초기화</Link>
              )}
            </div>
          </form>
        </div>

        <section className="bg-section py-10 md:py-16" aria-label="모임 목록">
          <div className="mx-auto max-w-[1024px] px-4">
            {error ? (
              <Tile className="bg-card text-center">
                <p role="alert" className="text-eyebrow text-destructive">모임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
                <Button asChild variant="secondary" className="mt-6"><Link href="/groups">다시 시도</Link></Button>
              </Tile>
            ) : !groups?.length ? (
              <Tile className="bg-card px-6 py-14 text-center md:py-20">
                <h2 className="text-eyebrow font-semibold tracking-tight md:text-title">
                  {filtered ? "조건에 맞는 모임이 없습니다" : "아직 만들어진 모임이 없습니다"}
                </h2>
                <p className="mx-auto mt-3 max-w-[420px] text-body text-muted-foreground">
                  {filtered ? "지역이나 유형을 바꿔 다시 찾아보세요." : "첫 모임을 만들고 함께 칠 골프 친구를 모아 보세요."}
                </p>
                <Button asChild className="mt-8">
                  {filtered ? <Link href="/groups">전체 모임 보기</Link> : <Link href={createHref as never}>모임 만들기</Link>}
                </Button>
              </Tile>
            ) : (
              <>
                <p className="mb-4 text-small text-muted-foreground">모임 {groups.length}개</p>
                <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
                  {groups.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/groups/${g.id}`}
                        className="pressable group flex min-h-[116px] items-center gap-4 rounded-tile bg-card p-5 outline-none hover:bg-card/70 focus-visible:ring-4 focus-visible:ring-ring/40 md:p-6"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-small font-medium text-primary">{GROUP_TYPE_LABEL[g.type]}</p>
                          <p className="mt-1 truncate text-eyebrow font-semibold tracking-tight">{g.name}</p>
                          <p className="mt-2 text-small text-muted-foreground tabular-nums">
                            {REGION_LABEL[g.region]} · 멤버 {g.member_count}/{g.capacity}명 · {JOIN_POLICY_LABEL[g.join_policy]}
                          </p>
                        </div>
                        <span aria-hidden className="text-eyebrow text-muted-foreground transition group-hover:translate-x-0.5">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

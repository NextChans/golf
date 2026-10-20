import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tile } from "@/components/site/section";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { formatKst } from "@/lib/format/kst";
import { REGION_LABEL } from "@/lib/domain/course/schema";
import {
  ADMIN_GROUP_STATUS_LABEL,
  ADMIN_GROUP_TYPE_LABEL,
  ADMIN_REPORT_REASON_LABEL,
  ADMIN_REPORT_TARGET_LABEL,
  COMMUNITY_TABS,
  COMMUNITY_TAB_LABEL,
  excerpt,
  parseCommunityTab,
  type CommunityTab,
  type GroupStatus,
  type GroupType,
  type ReportReason,
  type ReportTarget,
} from "@/lib/domain/community/admin-schema";
import type { Region } from "@/lib/domain/course/schema";
import { cn } from "@/lib/utils";
import { GroupActions, PostActions, ReportActions } from "./moderation-buttons";

export const metadata: Metadata = { title: "커뮤니티 관리", robots: { index: false } };

// 이 화면은 액션 뒤 제자리 갱신(revalidatePath)하므로 loading.tsx·<Suspense>를 두지 않는다(D-62)
const LIMIT = 100;
const REPORT_SELECT = `id, target_type, target_id, reason, detail, created_at,
  reporter:profiles!community_reports_reporter_id_fkey(display_name),
  group:groups!community_reports_group_id_fkey(id, name, status)`;
const GROUP_SELECT = `id, name, type, region, description, status, status_reason, member_count, created_at,
  owner:profiles!groups_owner_id_fkey(display_name)`;

type Supabase = Awaited<ReturnType<typeof createClient>>;

const errorBox = (text: string) => (
  <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{text}</p>
);
const empty = (title: string, body: string) => (
  <Tile className="p-8 text-center md:p-12">
    <p className="text-eyebrow tracking-tight">{title}</p>
    <p className="mt-2 text-small text-muted-foreground">{body}</p>
  </Tile>
);

function statusBadge(status: GroupStatus) {
  const variant = status === "active" ? "default" : status === "review" ? "secondary" : "outline";
  return <Badge variant={variant}>{ADMIN_GROUP_STATUS_LABEL[status]}</Badge>;
}

export default async function CommunityAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requireStaff();
  const tab = parseCommunityTab((await searchParams).tab);
  const supabase = await createClient();

  const [openCount, reviewCount] = await Promise.all([
    supabase.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("groups").select("id", { count: "exact", head: true }).eq("status", "review"),
  ]);
  const countOf: Partial<Record<CommunityTab, number | null>> = { reports: openCount.count, review: reviewCount.count };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title tracking-tight">커뮤니티 관리</h1>
        <p className="mt-2 text-body text-muted-foreground">
          신고를 처리하고, 금칙어로 보류된 모임을 검수합니다. 열린 신고가 3건 쌓인 모임·게시글은 자동으로 숨겨집니다.
        </p>
      </div>

      <nav aria-label="커뮤니티 탭" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {COMMUNITY_TABS.map((t) => (
            <li key={t}>
              <Link
                href={`/admin/community?tab=${t}`}
                aria-current={t === tab ? "page" : undefined}
                className={cn(
                  "pressable inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-small whitespace-nowrap",
                  t === tab ? "bg-foreground text-background" : "bg-section text-foreground hover:bg-border/60",
                )}
              >
                {COMMUNITY_TAB_LABEL[t]}
                {countOf[t] != null && <span className="tabular-nums">{countOf[t]}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "reports" ? <Reports supabase={supabase} /> : <Groups supabase={supabase} reviewOnly={tab === "review"} />}
    </div>
  );
}

async function Reports({ supabase }: { supabase: Supabase }) {
  const list = await supabase
    .from("community_reports")
    .select(REPORT_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (list.error) return errorBox("신고 목록을 불러오지 못했습니다. 새로고침해 주세요.");
  const rows = (list.data ?? []) as unknown as ReportRow[];
  if (rows.length === 0) return empty("열린 신고가 없습니다", "회원이 모임·게시글·회원을 신고하면 여기에 표시됩니다.");

  // 대상별 부가 정보는 종류마다 한 번씩만 조회한다(N+1 없음)
  const ids = (type: ReportTarget) => [...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id))];
  const postIds = ids("post");
  const userIds = ids("user");
  const targetIds = [...new Set(rows.map((r) => r.target_id))];
  const [posts, users, open] = await Promise.all([
    postIds.length
      ? supabase.from("group_posts").select("id, title, body, status, author:profiles!group_posts_author_id_fkey(display_name)").in("id", postIds)
      : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    supabase.from("community_reports").select("target_type, target_id").eq("status", "open").in("target_id", targetIds),
  ]);
  const postById = new Map(((posts.data ?? []) as unknown as PostRow[]).map((p) => [p.id, p]));
  const userById = new Map((users.data ?? []).map((u) => [u.id, u.display_name] as const));
  const openByTarget = new Map<string, number>();
  for (const r of open.data ?? []) {
    const k = `${r.target_type}:${r.target_id}`;
    openByTarget.set(k, (openByTarget.get(k) ?? 0) + 1);
  }

  return (
    <>
      <ul aria-label="신고 목록" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
        {rows.map((r) => {
          const post = r.target_type === "post" ? postById.get(r.target_id) : undefined;
          const sameTarget = openByTarget.get(`${r.target_type}:${r.target_id}`) ?? 1;
          return (
            <li key={r.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{ADMIN_REPORT_TARGET_LABEL[r.target_type]}</Badge>
                    <p className="text-body font-semibold">{ADMIN_REPORT_REASON_LABEL[r.reason]}</p>
                    {sameTarget > 1 && (
                      <span className="text-micro text-destructive tabular-nums">같은 대상 열린 신고 {sameTarget}건</span>
                    )}
                  </div>
                  <p className="text-micro text-muted-foreground tabular-nums">
                    #{r.id} · 신고자 {r.reporter?.display_name ?? "회원"} · 모임 {r.group?.name ?? "-"} · {formatKst(r.created_at)}
                  </p>
                  {r.detail && <p className="text-small whitespace-pre-line break-words">{r.detail}</p>}
                </div>
                <ReportActions reportId={r.id} />
              </div>

              {r.target_type === "post" && (
                <div className="space-y-2 rounded-xl bg-section px-4 py-3">
                  {post ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-small font-semibold break-words">{post.title}</p>
                        <Badge variant={post.status === "active" ? "default" : "outline"}>
                          {post.status === "active" ? "게시 중" : post.status === "hidden" ? "숨김" : "삭제됨"}
                        </Badge>
                      </div>
                      <p className="text-micro text-muted-foreground">작성자 {post.author?.display_name ?? "회원"}</p>
                      <p className="text-small text-muted-foreground break-words">{excerpt(post.body)}</p>
                      {post.status !== "deleted" && <PostActions postId={post.id} hidden={post.status === "hidden"} />}
                    </>
                  ) : (
                    <p className="text-small text-muted-foreground">게시글을 찾을 수 없습니다.</p>
                  )}
                </div>
              )}
              {r.target_type === "group" && r.group && (
                <p className="text-small">
                  모임 상태 {ADMIN_GROUP_STATUS_LABEL[r.group.status]} ·{" "}
                  <Link className="text-primary underline-offset-4 hover:underline" href={`/admin/community?tab=groups#group-${r.group.id}`}>
                    모임 관리로 이동
                  </Link>
                </p>
              )}
              {r.target_type === "user" && (
                <p className="text-small text-muted-foreground">신고된 회원 {userById.get(r.target_id) ?? "회원"}</p>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length === LIMIT && <p className="text-micro text-muted-foreground">최근 {LIMIT}건까지 표시합니다.</p>}
    </>
  );
}

async function Groups({ supabase, reviewOnly }: { supabase: Supabase; reviewOnly: boolean }) {
  let q = supabase.from("groups").select(GROUP_SELECT);
  if (reviewOnly) q = q.eq("status", "review");
  const list = await q.order("created_at", { ascending: false }).limit(LIMIT);
  if (list.error) return errorBox("모임 목록을 불러오지 못했습니다. 새로고침해 주세요.");
  const rows = (list.data ?? []) as unknown as GroupRow[];
  if (rows.length === 0) {
    return reviewOnly
      ? empty("검수 대기 모임이 없습니다", "금칙어가 들어간 모임이 개설되면 여기에서 확인합니다.")
      : empty("모임이 없습니다", "회원이 모임을 만들면 여기에 표시됩니다.");
  }

  return (
    <>
      <ul aria-label={reviewOnly ? "검수 대기 모임 목록" : "모임 목록"}
        className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
        {rows.map((g) => (
          <li key={g.id} id={`group-${g.id}`} className="scroll-mt-16 space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-body font-semibold break-words">{g.name}</p>
                  {statusBadge(g.status)}
                </div>
                <p className="text-micro text-muted-foreground tabular-nums">
                  {ADMIN_GROUP_TYPE_LABEL[g.type]} · {REGION_LABEL[g.region]} · 멤버 {g.member_count}명 · 모임장 {g.owner?.display_name ?? "회원"} · {formatKst(g.created_at)}
                </p>
                {g.status_reason && <p className="text-small text-destructive">사유: {g.status_reason}</p>}
              </div>
              <GroupActions groupId={g.id} status={g.status} groupName={g.name} />
            </div>
            {reviewOnly && <p className="text-small whitespace-pre-line break-words text-muted-foreground">{g.description}</p>}
          </li>
        ))}
      </ul>
      {rows.length === LIMIT && <p className="text-micro text-muted-foreground">최근 {LIMIT}건까지 표시합니다.</p>}
    </>
  );
}

type ReportRow = {
  id: number;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  detail: string | null;
  created_at: string;
  reporter: { display_name: string | null } | null;
  group: { id: string; name: string; status: GroupStatus } | null;
};
type PostRow = { id: string; title: string; body: string; status: string; author: { display_name: string | null } | null };
type GroupRow = {
  id: string;
  name: string;
  type: GroupType;
  region: Region;
  description: string;
  status: GroupStatus;
  status_reason: string | null;
  member_count: number;
  created_at: string;
  owner: { display_name: string | null } | null;
};

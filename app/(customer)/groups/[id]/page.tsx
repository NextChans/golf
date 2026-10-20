import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Tile } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKst } from "@/lib/format/kst";
import { REGION_LABEL } from "@/lib/domain/course/schema";
import {
  GROUP_ROLE_LABEL, GROUP_STATUS_LABEL, GROUP_TYPE_LABEL, isGroupManager, JOIN_POLICY_LABEL, type GroupRole,
} from "@/lib/domain/community/labels";
import { formatMeetingFee } from "@/lib/domain/community/schema";
import {
  attendMeeting, cancelAttendance, decideJoin, deletePost, kickMember, leaveGroup, setMemberRole, setPostPinned, unbanMember,
} from "../actions";
import { loadGroup, UUID_RE } from "../data";
import { CancelMeetingButton, JoinForm, PostForm, ReportButton, RunButton } from "./controls";

export const metadata: Metadata = { title: "골프 모임" };

// D-62: 이 화면은 액션 후 제자리 갱신(revalidatePath)이 있으므로 loading.tsx·<Suspense>를 두지 않는다.

const ROLE_ORDER: Record<GroupRole, number> = { owner: 0, manager: 1, member: 2 };

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, session, isCustomer, group: g, me } = await loadGroup(id);
  // 없음·비공개(비멤버에게 RLS로 0행)는 같은 화면
  if (!g) notFound();

  const isMember = me?.status === "active";
  const myRole = isMember ? me.role : null;
  const manager = isGroupManager(myRole);
  const owner = myRole === "owner";

  // 멤버만 정모·게시판·멤버 목록을 본다(RLS). 정모 참석자는 정모 조회에 함께 싣고, 이름은 멤버 목록에서 찾는다(N+1 없음).
  const [membersRes, meetingsRes, postsRes] = isMember
    ? await Promise.all([
        supabase
          .from("group_members")
          .select("user_id, display_name, role, status, join_message, joined_at, created_at")
          .eq("group_id", id)
          .order("created_at"),
        supabase
          .from("group_meetings")
          .select("id, title, starts_at, place_free, capacity, attendee_count, fee_per_person, note, golf_courses(name), meeting_attendees(user_id, created_at)")
          .eq("group_id", id)
          .eq("status", "scheduled")
          .gt("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(20),
        supabase
          .from("group_posts")
          .select("id, title, body, is_notice, is_pinned, author_id, created_at")
          .eq("group_id", id)
          .eq("status", "active")
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50),
      ])
    : [null, null, null];
  if (membersRes?.error || meetingsRes?.error || postsRes?.error) throw new Error("group content query failed");

  const allMembers = membersRes?.data ?? [];
  const nameOf = new Map(allMembers.map((m) => [m.user_id, m.display_name]));
  const active = allMembers
    .filter((m) => m.status === "active")
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.joined_at ?? "").localeCompare(b.joined_at ?? ""));
  const pending = allMembers.filter((m) => m.status === "pending");
  const banned = allMembers.filter((m) => m.status === "banned");
  const meetings = meetingsRes?.data ?? [];
  const posts = postsRes?.data ?? [];
  const me_ = session?.userId;
  const loginHref = `/login?next=${encodeURIComponent(`/groups/${g.id}`)}`;

  let cta: React.ReactNode;
  if (!session) {
    cta = (
      <div className="space-y-4 text-center">
        <p className="text-body text-muted-foreground">가입은 로그인 후 이용할 수 있습니다.</p>
        <Button asChild><Link href={loginHref as never}>로그인하고 가입하기</Link></Button>
      </div>
    );
  } else if (!isCustomer) {
    cta = <p className="text-body text-muted-foreground">운영자 계정으로는 모임에 가입할 수 없습니다.</p>;
  } else if (me?.status === "banned") {
    cta = (
      <div className="text-center" data-testid="group-banned">
        <p className="text-eyebrow font-semibold">가입할 수 없습니다</p>
        <p className="mt-2 text-body text-muted-foreground">모임 운영진이 가입을 제한했습니다.</p>
      </div>
    );
  } else if (me?.status === "pending") {
    cta = (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-eyebrow font-semibold" data-testid="join-status">승인 대기 중</p>
        <p className="text-body text-muted-foreground">운영진이 확인하면 알림으로 알려드립니다.</p>
        <RunButton action={leaveGroup} input={{ groupId: g.id }} confirmText="가입 신청을 취소할까요?" variant="ghost">
          신청 취소
        </RunButton>
      </div>
    );
  } else if (isMember) {
    cta = (
      <div className="flex flex-col gap-4">
        <p className="text-body">
          <span className="font-semibold">{me.display_name}</span>님은 이 모임의 {GROUP_ROLE_LABEL[me.role]}입니다.
        </p>
        {g.open_chat_url ? (
          <Button asChild variant="outline">
            <a href={g.open_chat_url} target="_blank" rel="noopener noreferrer">오픈채팅 참여</a>
          </Button>
        ) : (
          <p className="text-small text-muted-foreground">등록된 오픈채팅이 없습니다.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {manager && (
            <Button asChild variant="secondary" size="sm"><Link href={`/groups/${g.id}/edit`}>모임 정보 수정</Link></Button>
          )}
          <RunButton
            action={leaveGroup} input={{ groupId: g.id }} variant="ghost" className="text-destructive"
            confirmText={owner
              ? "모임을 나갈까요? 모임장 권한은 운영진 또는 가장 먼저 가입한 멤버에게 자동으로 넘어가고, 남은 멤버가 없으면 모임이 종료됩니다."
              : "모임을 나갈까요? 앞으로 잡힌 정모 참석도 함께 취소됩니다."}
          >
            모임 나가기
          </RunButton>
        </div>
      </div>
    );
  } else if (g.status !== "active") {
    cta = <p className="text-body text-muted-foreground">지금은 가입할 수 없는 모임입니다.</p>;
  } else if (g.join_policy === "open" && g.member_count >= g.capacity) {
    cta = <p className="text-body text-muted-foreground">모임 정원이 가득 찼습니다.</p>;
  } else {
    cta = <JoinForm groupId={g.id} policy={g.join_policy} />;
  }

  return (
    <>
      <GlobalNav />
      <LocalNav title={g.name} />
      <main>
        <div className="mx-auto max-w-[1024px] px-4 pt-8 pb-10 md:pt-12 md:pb-14">
          <Link
            href="/groups"
            className="pressable inline-flex min-h-11 items-center gap-1 text-small text-primary hover:underline underline-offset-4"
          >
            <span aria-hidden className="text-[1.1em] leading-none">‹</span>골프 모임
          </Link>
          <p className="mt-4 text-eyebrow text-muted-foreground">
            {GROUP_TYPE_LABEL[g.type]} · {REGION_LABEL[g.region]}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-title font-semibold tracking-tight md:text-headline">{g.name}</h1>
            {g.status !== "active" && (
              <Badge variant="secondary" className="px-3 py-1 text-small" data-testid="group-status">{GROUP_STATUS_LABEL[g.status]}</Badge>
            )}
          </div>
          <p className="mt-3 text-body text-muted-foreground tabular-nums">
            멤버 {g.member_count}/{g.capacity}명 · {JOIN_POLICY_LABEL[g.join_policy]}
          </p>
          {g.status === "review" && (
            <p className="mt-3 text-small text-muted-foreground">운영자가 확인한 뒤 모임 목록에 공개됩니다.</p>
          )}
          <p className="mt-6 max-w-[720px] text-body whitespace-pre-wrap">{g.description}</p>
          {isCustomer && (me?.role !== "owner" || !isMember) && (
            <div className="mt-4"><ReportButton targetType="group" targetId={g.id} /></div>
          )}
        </div>

        <div className="bg-section py-10 md:py-16">
          <div className="mx-auto grid max-w-[1024px] gap-4 px-4 md:gap-6">
            <Tile className="bg-card p-6 md:p-8">
              <section aria-labelledby="membership-title">
                <h2 id="membership-title" className="mb-5 text-eyebrow font-semibold tracking-tight">
                  {isMember ? "내 멤버십" : "모임 가입"}
                </h2>
                {cta}
              </section>
            </Tile>

            {isMember && (
              <>
                <nav aria-label="모임 메뉴" className="flex gap-2 overflow-x-auto">
                  {[["#meetings", "정모"], ["#board", "게시판"], ["#members", "멤버"]].map(([href, label]) => (
                    <a key={href} href={href} className="pressable rounded-full bg-card px-4 py-2 text-small font-medium">{label}</a>
                  ))}
                </nav>

                {/* 정모 */}
                <Tile className="scroll-mt-28 bg-card p-6 md:p-8" id="meetings">
                  <section aria-labelledby="meetings-title">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <h2 id="meetings-title" className="text-eyebrow font-semibold tracking-tight">정모</h2>
                      {manager && g.status === "active" && (
                        <Button asChild size="sm"><Link href={`/groups/${g.id}/meetings/new`}>정모 만들기</Link></Button>
                      )}
                    </div>
                    {meetings.length === 0 ? (
                      <p className="text-body text-muted-foreground">예정된 정모가 없습니다.</p>
                    ) : (
                      <ul className="divide-y divide-border/70">
                        {meetings.map((m) => {
                          const attendees = [...m.meeting_attendees].sort((a, b) => a.created_at.localeCompare(b.created_at));
                          const attending = attendees.some((a) => a.user_id === me_);
                          const full = m.attendee_count >= m.capacity;
                          return (
                            <li key={m.id} className="py-4 first:pt-0 last:pb-0" aria-label={`정모 ${m.title}`}>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-body font-semibold">{m.title}</p>
                                  <p className="mt-1 text-small tabular-nums">{formatKst(m.starts_at)}</p>
                                  <p className="text-small text-muted-foreground">
                                    {m.golf_courses?.name ?? m.place_free ?? "장소 미정"} · {formatMeetingFee(m.fee_per_person)}
                                  </p>
                                </div>
                                <p className="shrink-0 text-small tabular-nums" data-testid="meeting-count">
                                  참석 {m.attendee_count}/{m.capacity}명
                                </p>
                              </div>
                              {m.note && <p className="mt-2 text-small whitespace-pre-wrap text-muted-foreground">{m.note}</p>}
                              <p className="mt-2 text-small text-muted-foreground">
                                참석자: {attendees.length ? attendees.map((a) => nameOf.get(a.user_id) ?? "탈퇴한 멤버").join(", ") : "아직 없음"}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {attending ? (
                                  <RunButton action={cancelAttendance} input={{ meetingId: m.id }} variant="secondary">참석 취소</RunButton>
                                ) : full ? (
                                  <Button type="button" size="sm" variant="secondary" disabled>마감</Button>
                                ) : (
                                  <RunButton action={attendMeeting} input={{ meetingId: m.id }} variant="default">참석</RunButton>
                                )}
                                {manager && <CancelMeetingButton meetingId={m.id} />}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </Tile>

                {/* 게시판 */}
                <Tile className="scroll-mt-28 bg-card p-6 md:p-8" id="board">
                  <section aria-labelledby="board-title">
                    <h2 id="board-title" className="mb-5 text-eyebrow font-semibold tracking-tight">게시판</h2>
                    <PostForm groupId={g.id} canNotice={manager} />
                    {posts.length === 0 ? (
                      <p className="mt-6 text-body text-muted-foreground">아직 올라온 글이 없습니다.</p>
                    ) : (
                      <ul className="mt-6 divide-y divide-border/70">
                        {posts.map((p) => (
                          <li key={p.id} className="py-4" aria-label={`게시글 ${p.title}`}>
                            <div className="flex flex-wrap items-center gap-2">
                              {p.is_notice && <Badge className="px-2 py-0.5 text-micro">공지</Badge>}
                              {p.is_pinned && <Badge variant="secondary" className="px-2 py-0.5 text-micro">고정</Badge>}
                              <p className="min-w-0 text-body font-semibold">{p.title}</p>
                            </div>
                            <p className="mt-1 text-micro text-muted-foreground">
                              {nameOf.get(p.author_id) ?? "탈퇴한 멤버"} · {formatKst(p.created_at)}
                            </p>
                            <p className="mt-2 text-body whitespace-pre-wrap">{p.body}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {manager && (
                                <RunButton
                                  action={setPostPinned} input={{ postId: p.id, groupId: g.id, pinned: !p.is_pinned }}
                                  variant="ghost" size="xs"
                                >
                                  {p.is_pinned ? "고정 해제" : "고정"}
                                </RunButton>
                              )}
                              {(manager || p.author_id === me_) && (
                                <RunButton
                                  action={deletePost} input={{ postId: p.id, groupId: g.id }} confirmText="글을 삭제할까요?"
                                  variant="ghost" size="xs" className="text-destructive"
                                >
                                  삭제
                                </RunButton>
                              )}
                              {p.author_id !== me_ && <ReportButton targetType="post" targetId={p.id} />}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </Tile>

                {/* 멤버 */}
                <Tile className="scroll-mt-28 bg-card p-6 md:p-8" id="members">
                  <section aria-labelledby="members-title">
                    <h2 id="members-title" className="mb-5 text-eyebrow font-semibold tracking-tight">멤버 {active.length}명</h2>

                    {manager && pending.length > 0 && (
                      <section aria-label="가입 신청" className="mb-6 rounded-tile bg-section p-4">
                        <h3 className="mb-3 text-body font-semibold">가입 신청 {pending.length}건</h3>
                        <ul className="divide-y divide-border/70">
                          {pending.map((m) => (
                            <li key={m.user_id} className="py-3" aria-label={`가입 신청 ${m.display_name}`}>
                              <p className="text-body font-medium">{m.display_name}</p>
                              {m.join_message && <p className="mt-1 text-small whitespace-pre-wrap text-muted-foreground">{m.join_message}</p>}
                              <div className="mt-2 flex gap-2">
                                <RunButton action={decideJoin} input={{ groupId: g.id, userId: m.user_id, approve: true }} variant="default">승인</RunButton>
                                <RunButton
                                  action={decideJoin} input={{ groupId: g.id, userId: m.user_id, approve: false }}
                                  confirmText={`${m.display_name}님의 가입 신청을 거절할까요?`}
                                >
                                  거절
                                </RunButton>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <ul className="divide-y divide-border/70">
                      {active.map((m) => {
                        const self = m.user_id === me_;
                        const kickable = !self && (owner ? m.role !== "owner" : manager && m.role === "member");
                        return (
                          <li key={m.user_id} className="py-3" aria-label={`멤버 ${m.display_name}`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-body font-medium">{m.display_name}{self && <span className="text-muted-foreground"> (나)</span>}</p>
                              <Badge variant={m.role === "member" ? "secondary" : "default"} className="px-2 py-0.5 text-micro">
                                {GROUP_ROLE_LABEL[m.role]}
                              </Badge>
                            </div>
                            {!self && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {owner && m.role === "member" && (
                                  <RunButton action={setMemberRole} input={{ groupId: g.id, userId: m.user_id, role: "manager" }} size="xs">운영진으로</RunButton>
                                )}
                                {owner && m.role === "manager" && (
                                  <RunButton action={setMemberRole} input={{ groupId: g.id, userId: m.user_id, role: "member" }} size="xs">멤버로</RunButton>
                                )}
                                {owner && (
                                  <RunButton
                                    action={setMemberRole} input={{ groupId: g.id, userId: m.user_id, role: "owner" }} size="xs"
                                    confirmText={`${m.display_name}님에게 모임장을 넘길까요? 나는 운영진이 됩니다.`}
                                  >
                                    모임장 넘기기
                                  </RunButton>
                                )}
                                {kickable && (
                                  <RunButton
                                    action={kickMember} input={{ groupId: g.id, userId: m.user_id }} size="xs" variant="ghost"
                                    className="text-destructive"
                                    confirmText={`${m.display_name}님을 내보낼까요? 내보낸 멤버는 다시 가입할 수 없습니다.`}
                                  >
                                    내보내기
                                  </RunButton>
                                )}
                                <ReportButton targetType="user" targetId={m.user_id} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {owner && banned.length > 0 && (
                      <section aria-label="차단한 멤버" className="mt-6 rounded-tile bg-section p-4">
                        <h3 className="mb-3 text-body font-semibold">차단한 멤버</h3>
                        <ul className="divide-y divide-border/70">
                          {banned.map((m) => (
                            <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                              <p className="text-body">{m.display_name}</p>
                              <RunButton
                                action={unbanMember} input={{ groupId: g.id, userId: m.user_id }} size="xs"
                                confirmText={`${m.display_name}님의 차단을 해제할까요? 다시 가입할 수 있게 됩니다.`}
                              >
                                차단 해제
                              </RunButton>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </section>
                </Tile>
              </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  cancelMeetingSchema, decideJoinSchema, fieldErrorsOf, groupIdSchema, meetingIdSchema, memberTargetSchema,
  parseCreateGroupForm, parseCreatePostForm, parseJoinForm, parseMeetingForm, parseReportForm, parseUpdateGroupForm,
  pinPostSchema, postIdSchema, setMemberRoleSchema,
} from "@/lib/domain/community/schema";

/**
 * 골프 모임(M7) 고객 액션. 권한·정원·상태·금칙어는 DB 함수가 최종 판단한다(신뢰 경계).
 * 제자리 갱신은 revalidatePath로 한다(D-62: [id]에는 loading.tsx·Suspense를 두지 않는다).
 * 정모 개설·모임 수정은 돌아갈 모임 화면을 revalidatePath로 비운다: 폼 화면의 "‹ 모임" 링크가 미리 받아 둔(prefetch)
 * 옛 화면이 router.replace 후 그대로 그려지는 것을 막는다(D-62, admin memberships/actions.ts와 같은 이유).
 * 모임 만들기는 새 id라 미리 받은 화면이 없으므로 부르지 않는다(bookings/actions.ts: router.replace와 경합).
 */

export type FormState = {
  fieldErrors?: Partial<Record<string, string>>;
  error?: string;
  /** 생성·수정 후 이동할 모임 id */
  groupId?: string;
  /** 성공 표시(게시글 작성·가입 신청·신고 폼 초기화용) */
  done?: number;
};

const refresh = (groupId: string) => revalidatePath(`/groups/${groupId}`);

/** 모임 만들기(멱등키는 폼 렌더 시 서버가 발급) */
export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer();
  const parsed = parseCreateGroupForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_idempotency_key: v.idempotencyKey,
    p_name: v.name,
    p_type: v.type,
    p_region: v.region,
    p_description: v.description,
    p_join_policy: v.joinPolicy,
    p_capacity: v.capacity,
    p_open_chat_url: v.openChatUrl as string,
  });
  if (error || !data) return { error: toAppError(error).message };
  return { groupId: data.id };
}

export async function updateGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer();
  const parsed = parseUpdateGroupForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_group", {
    p_group_id: v.groupId,
    p_expected_version: v.expectedVersion,
    p_name: v.name,
    p_region: v.region,
    p_description: v.description,
    p_join_policy: v.joinPolicy,
    p_capacity: v.capacity,
    p_open_chat_url: v.openChatUrl as string,
  });
  if (error || !data) {
    const e = toAppError(error);
    // 정원을 현재 인원보다 줄이면 DB가 invalid_input으로 거부한다
    if (e.code === "invalid_input") return { fieldErrors: { capacity: "정원은 현재 멤버 수 이상이어야 합니다." }, error: e.message };
    return { error: e.message };
  }
  refresh(data.id);
  return { groupId: data.id };
}

/** 가입(공개: 즉시, 승인제: 대기 + 인사말) */
export async function joinGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer();
  const parsed = parseJoinForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group", {
    p_group_id: parsed.data.groupId,
    p_message: parsed.data.message ?? undefined,
  });
  if (error) return { error: toAppError(error).message };
  refresh(parsed.data.groupId);
  revalidatePath("/groups");
  return { done: Date.now() };
}

/** 탈퇴·가입 신청 취소(모임장이면 자동 승계) */
export async function leaveGroup(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = groupIdSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { p_group_id: parsed.data.groupId });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  revalidatePath("/groups");
  return ok(undefined);
}

export async function decideJoin(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = decideJoinSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join", {
    p_group_id: parsed.data.groupId, p_user_id: parsed.data.userId, p_approve: parsed.data.approve,
  });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  return ok(undefined);
}

export async function kickMember(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = memberTargetSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("kick_member", { p_group_id: parsed.data.groupId, p_user_id: parsed.data.userId });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  return ok(undefined);
}

export async function unbanMember(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = memberTargetSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("unban_member", { p_group_id: parsed.data.groupId, p_user_id: parsed.data.userId });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  return ok(undefined);
}

/** 역할 변경·모임장 위임(모임장만) */
export async function setMemberRole(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = setMemberRoleSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_group_id: parsed.data.groupId, p_user_id: parsed.data.userId, p_role: parsed.data.role,
  });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  return ok(undefined);
}

/** 정모 개설(모임장·운영진). 성공하면 모임 화면으로 이동 */
export async function createMeeting(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer();
  const parsed = parseMeetingForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_meeting", {
    p_group_id: v.groupId,
    p_title: v.title,
    p_starts_at: v.startsAt,
    p_golf_course_id: v.golfCourseId as string,
    p_place_free: v.placeFree as string,
    p_capacity: v.capacity,
    p_fee_per_person: v.feePerPerson as number,
    p_note: v.note as string,
  });
  if (error || !data) return { error: toAppError(error).message };
  refresh(data.group_id);
  return { groupId: data.group_id };
}

export async function attendMeeting(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attend_meeting", { p_meeting_id: parsed.data.meetingId });
  if (error || !data) return fail(toAppError(error));
  refresh(data.group_id);
  return ok(undefined);
}

export async function cancelAttendance(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_attendance", { p_meeting_id: parsed.data.meetingId });
  if (error || !data) return fail(toAppError(error));
  refresh(data.group_id);
  return ok(undefined);
}

export async function cancelMeeting(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = cancelMeetingSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_meeting", {
    p_meeting_id: parsed.data.meetingId, p_reason: parsed.data.reason as string,
  });
  if (error || !data) return fail(toAppError(error));
  refresh(data.group_id);
  return ok(undefined);
}

/** 게시글 작성(공지는 모임장·운영진만 — DB가 최종 판단) */
export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer();
  const parsed = parseCreatePostForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_post", {
    p_group_id: v.groupId, p_title: v.title, p_body: v.body, p_is_notice: v.isNotice,
  });
  if (error || !data) return { error: toAppError(error).message };
  refresh(v.groupId);
  return { done: Date.now() };
}

// 게시글 삭제·고정은 반환값이 없어 갱신할 모임 id를 함께 받는다(권한 판단에는 쓰지 않는다)
export async function deletePost(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = postIdSchema.extend(groupIdSchema.shape).safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_post", { p_post_id: parsed.data.postId });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  return ok(undefined);
}

export async function setPostPinned(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = pinPostSchema.extend(groupIdSchema.shape).safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_post_pinned", { p_post_id: parsed.data.postId, p_pinned: parsed.data.pinned });
  if (error) return fail(toAppError(error));
  refresh(parsed.data.groupId);
  return ok(undefined);
}

/** 신고(모임·게시글·회원). 화면 갱신은 필요 없다(신고 즉시 바뀌는 표시 없음) */
export async function reportContent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer();
  const parsed = parseReportForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_content", {
    p_target_type: v.targetType, p_target_id: v.targetId, p_reason: v.reason, p_detail: v.detail as string,
  });
  if (error) return { error: toAppError(error).message };
  // 신고 누적으로 글·모임이 자동 비노출되면 신고한 사람 화면에도 바로 반영한다(모임 상세는 Suspense 없음, D-62)
  revalidatePath("/groups/[id]", "page");
  return { done: Date.now() };
}

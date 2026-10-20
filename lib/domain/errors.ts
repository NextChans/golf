/**
 * DB 함수 에러(SQLSTATE GBxxx, message=기계 코드)를 사용자 메시지로 바꾼다.
 * 코드표: supabase/migrations/20261020000003_helpers.sql, docs/RUNBOOK.md
 */
export type AppErrorCode =
  | "unauthenticated" | "forbidden" | "onboarding_required" | "not_found"
  | "version_conflict" | "invalid_state" | "proposal_expired" | "listing_unavailable"
  | "duplicate_inquiry" | "idempotency_key_reused" | "invalid_input" | "rate_limited"
  | "phone_not_verified" | "terms_required" | "contact_required" | "duplicate_name"
  | "limit_exceeded" | "group_full" | "meeting_full" | "duplicate_report" | "unknown";

export type AppError = { code: AppErrorCode; message: string };

const MESSAGES: Record<AppErrorCode, string> = {
  unauthenticated: "로그인이 필요합니다.",
  forbidden: "권한이 없습니다.",
  onboarding_required: "휴대폰 인증과 약관 동의를 먼저 완료해 주세요.",
  not_found: "요청하신 정보를 찾을 수 없습니다.",
  version_conflict: "다른 곳에서 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
  invalid_state: "현재 상태에서는 처리할 수 없습니다. 새로고침 후 확인해 주세요.",
  proposal_expired: "제안 유효시간이 지났습니다.",
  listing_unavailable: "이미 다른 상담이 진행 중인 매물입니다.",
  duplicate_inquiry: "이미 진행 중인 상담이 있습니다.",
  idempotency_key_reused: "이미 처리된 요청입니다. 새로고침 후 확인해 주세요.",
  invalid_input: "입력값을 확인해 주세요.",
  rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  phone_not_verified: "휴대폰 인증을 먼저 완료해 주세요.",
  terms_required: "필수 약관에 동의해 주세요.",
  contact_required: "확인 전화를 받을 휴대폰 번호를 입력해 주세요.",
  duplicate_name: "같은 이름이 이미 등록되어 있습니다.",
  limit_exceeded: "모임은 3개까지 만들고 10개까지 가입할 수 있습니다.",
  group_full: "모임 정원이 가득 찼습니다.",
  meeting_full: "정모 정원이 가득 찼습니다.",
  duplicate_report: "이미 신고한 대상입니다. 운영자가 확인 중입니다.",
  unknown: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

const KNOWN = new Set(Object.keys(MESSAGES));

// 프론트가 아직 모르는 새 기계 코드(DB가 먼저 배포된 경우 등)는 SQLSTATE 계열로 대체한다.
// "일시적인 오류"는 재시도를 유도하므로, 재시도로 풀리지 않는 4xx 계열에는 쓰지 않는다(D-49).
const BY_SQLSTATE: Record<string, AppErrorCode> = {
  GB401: "unauthenticated", GB403: "forbidden", GB404: "not_found",
  GB409: "invalid_state", GB422: "invalid_input", GB429: "rate_limited",
};

/** PostgREST 에러 객체({ code, message })를 AppError로 변환한다. 내부 detail은 사용자에게 노출하지 않는다. */
export function toAppError(err: { code?: string; message?: string } | null | undefined): AppError {
  const raw = err?.message ?? "";
  if (err?.code === "42501") return { code: "forbidden", message: MESSAGES.forbidden };
  if (err?.code?.startsWith("GB") && KNOWN.has(raw)) {
    const code = raw as AppErrorCode;
    return { code, message: MESSAGES[code] };
  }
  const fallback = err?.code ? BY_SQLSTATE[err.code] : undefined;
  if (fallback) return { code: fallback, message: MESSAGES[fallback] };
  return { code: "unknown", message: MESSAGES.unknown };
}

export const appError = (code: AppErrorCode, message?: string): AppError => ({ code, message: message ?? MESSAGES[code] });

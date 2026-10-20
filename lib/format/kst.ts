const dateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
const dateOnly = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });

/** timestamptz 문자열 → "2026. 10. 20. 14:05" (KST) */
export function formatKst(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "-" : dateTime.format(d);
}

/** date(YYYY-MM-DD, KST 기준 값) → "2026. 10. 20. (화)" */
export function formatKstDate(value: string | null | undefined): string {
  if (!value) return "-";
  // date 컬럼은 KST 날짜이므로 KST 정오로 해석해 날짜가 밀리지 않게 한다
  const d = new Date(`${value}T12:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? "-" : dateOnly.format(d);
}

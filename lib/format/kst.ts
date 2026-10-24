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

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘 날짜(KST) "YYYY-MM-DD". KST는 서머타임이 없어 +9h 고정 */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** datetime-local 값(KST로 입력) → ISO 문자열(+09:00). KST는 서머타임이 없다 */
export function kstLocalToIso(local: string): string | null {
  const m = LOCAL_DT_RE.exec(local);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // 2026-02-31 같은 값은 Date가 넘겨 계산하므로 되돌려 비교해 거부한다
  const back = new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
  return back === local ? iso : null;
}

/** ISO → datetime-local 기본값(KST) */
export function isoToKstLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** 최근 확인한 회원권 id 목록 갱신: 중복 제거 → 맨 앞 삽입 → 상한(기본 10). 원본은 바꾸지 않는다 */
export function pushRecent(list: readonly string[], id: string, max = 10): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, Math.max(0, max));
}

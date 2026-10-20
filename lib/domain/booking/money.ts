const won = new Intl.NumberFormat("ko-KR");

/** 200000 → "200,000원", 값 없음 → "-" */
export function formatWon(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "-";
  return `${won.format(amount)}원`;
}

/** 총 그린피 = 1인 그린피 × 인원 */
export function totalGreenFee(perPerson: number, players: number): number {
  return perPerson * players;
}

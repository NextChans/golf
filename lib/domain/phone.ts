import { z } from "zod";

/** 한국 휴대폰 번호(010-1234-5678 등)를 E.164(+821012345678)로 정규화한다. */
export const krMobileSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^01[016789]\d{7,8}$/.test(v), "휴대폰 번호 형식을 확인해 주세요.")
  .transform((v) => `+82${v.slice(1)}`);

/** 목록 화면용 마스킹: +821012345678 → 010-****-5678 */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "-";
  const local = e164.startsWith("+82") ? `0${e164.slice(3)}` : e164;
  const digits = local.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 상세 화면용 표시: +821012345678 → 010-1234-5678 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "-";
  const local = e164.startsWith("+82") ? `0${e164.slice(3)}` : e164;
  const d = local.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : local;
}

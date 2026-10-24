/**
 * 사업자등록번호(10자리) 형식·검증번호 확인(D-81). 국세청 휴폐업 조회 같은 실제 인증은 하지 않는다 —
 * 실데이터 단계에서 어댑터(공공데이터포털 사업자등록 상태조회) 뒤에 둔다.
 */
const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

export const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "");

export function isValidBusinessNumber(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length !== 10 || /^0{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  let sum = WEIGHTS.reduce((acc, w, k) => acc + w * n[k]!, 0);
  sum += Math.floor((n[8]! * 5) / 10);
  return (10 - (sum % 10)) % 10 === n[9];
}

/** 입력 중 표시: "1234567890" → "123-45-67890"(10자리 초과는 자른다) */
export function formatBusinessNumber(input: string): string {
  const d = onlyDigits(input).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export type BusinessInput = { name: string; number: string };
export type BusinessErrors = Partial<Record<keyof BusinessInput, string>>;

export function validateBusiness(v: BusinessInput): BusinessErrors {
  const e: BusinessErrors = {};
  const name = v.name.trim();
  if (!name) e.name = "사업자명을 입력해 주세요.";
  else if (name.length > 60) e.name = "사업자명은 60자 이내로 입력해 주세요.";
  if (onlyDigits(v.number).length !== 10) e.number = "사업자등록번호 10자리를 입력해 주세요.";
  else if (!isValidBusinessNumber(v.number)) e.number = "사업자등록번호를 다시 확인해 주세요.";
  return e;
}

/** 가입 단계 이름(개인·기업 공통). 2단계 정보 입력은 /onboarding */
export const SIGNUP_STEPS = ["계정 연결", "정보 입력", "가입 완료"] as const;

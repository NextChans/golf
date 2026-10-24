"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBusinessNumber, SIGNUP_STEPS, validateBusiness } from "@/lib/domain/market/business";
import { primaryButtonClass, Stepper } from "./ui";

const inputClass =
  "h-14 w-full rounded-control border border-line bg-surface px-4 text-label font-medium text-ink outline-none placeholder:text-ink-faint focus:border-brand aria-invalid:border-up";

/**
 * 기업 가입 1단계: 사업자명·사업자등록번호(검증번호 확인). 2단계에서 담당자 카카오 계정을 연결한다.
 * 미리보기: 사업자 정보는 서버에 저장하지 않는다(기업 회원 테이블·국세청 상태조회는 실데이터 단계, D-81).
 * kakao 슬롯은 서버에서 만든 카카오 로그인 폼(Server Action)을 받는다.
 */
export function BusinessSignup({ kakao }: { kakao: React.ReactNode }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [touched, setTouched] = useState<{ name?: boolean; number?: boolean }>({});
  const [step, setStep] = useState(0);
  const errors = validateBusiness({ name, number });
  const valid = Object.keys(errors).length === 0;

  if (step === 1) {
    return (
      <>
        <Stepper steps={SIGNUP_STEPS} current={0} />
        <main className="px-6 pt-4 pb-12">
          <p className="text-caption font-semibold text-ink-mute">{name.trim()} · {formatBusinessNumber(number)}</p>
          <h2 className="mt-1 text-heading font-bold text-ink">담당자 카카오 계정을<br />연결해 주세요</h2>
          <p className="mt-2 text-caption text-ink-mute">거래 진행 안내는 담당자 연락처로 보내 드려요.</p>
          <div className="mt-10">{kakao}</div>
          <p className="mt-6 rounded-control bg-fill px-4 py-3 text-caption text-ink-sub">
            미리보기: 기업 정보는 아직 저장되지 않아요. 가입 후 상담 때 담당자가 사업자등록증을 확인합니다.
          </p>
          <button type="button" onClick={() => setStep(0)} className="pressable mt-4 h-11 w-full text-caption font-semibold text-ink-mute">사업자 정보 고치기</button>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="bg-fill/60">
        <Stepper steps={SIGNUP_STEPS} current={0} />
      </div>
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); setTouched({ name: true, number: true }); if (valid) setStep(1); }}
        className="flex min-h-[calc(100dvh-10rem)] flex-col px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="space-y-8">
          <div>
            <label htmlFor="biz-name" className="text-label font-bold text-ink-sub">사업자명</label>
            <input
              id="biz-name" value={name} maxLength={60} autoComplete="organization"
              onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              aria-invalid={touched.name && !!errors.name} aria-describedby="biz-name-err"
              placeholder="사업자명을 입력해주세요." className={`${inputClass} mt-3`}
            />
            {touched.name && errors.name && <p id="biz-name-err" className="mt-2 text-caption font-semibold text-up">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="biz-number" className="text-label font-bold text-ink-sub">사업자등록번호</label>
            <input
              id="biz-number" value={formatBusinessNumber(number)} inputMode="numeric" autoComplete="off"
              onChange={(e) => setNumber(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, number: true }))}
              aria-invalid={touched.number && !!errors.number} aria-describedby="biz-number-err"
              placeholder="숫자 10자리를 입력해주세요." className={`${inputClass} mt-3 tabular-nums`}
            />
            {touched.number && errors.number && <p id="biz-number-err" className="mt-2 text-caption font-semibold text-up">{errors.number}</p>}
          </div>
        </div>
        <div className="mt-auto pt-10">
          <button type="submit" disabled={!valid} className={`${primaryButtonClass} w-full`}>다음</button>
          <Link href="/market/mypage/support" className="pressable mt-4 flex h-11 items-center justify-center text-label font-semibold text-ink-mute">
            사업자 인증이 안되시나요?
          </Link>
        </div>
      </form>
    </>
  );
}

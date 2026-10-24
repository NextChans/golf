"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, TicketPercent } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { primaryButtonClass, secondaryButtonClass, Stepper, TopBar } from "@/components/market/ui";
import { formatPhone, krMobileSchema } from "@/lib/domain/phone";
import { SIGNUP_STEPS } from "@/lib/domain/market/business";
import { DISPLAY_NAME_MAX, welcomeLinks } from "@/lib/domain/market/signup";
import { cn } from "@/lib/utils";
import { completeOnboarding, sendPhoneOtp, verifyPhoneOtp } from "./actions";

type Term = { code: string; title: string; required: boolean };

const inputClass =
  "h-14 w-full min-w-0 rounded-control border border-line bg-surface px-4 text-label font-medium text-ink outline-none placeholder:text-ink-faint focus:border-brand aria-invalid:border-up disabled:opacity-60";
const labelClass = "text-label font-bold text-ink-sub";
const sideButtonClass =
  "pressable h-14 shrink-0 rounded-control border border-line bg-surface px-4 text-label font-bold text-ink-sub hover:bg-fill disabled:pointer-events-none disabled:opacity-40";
const checkClass =
  "size-6 rounded-full border-2 border-line bg-surface shadow-none data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white dark:bg-surface dark:data-[state=checked]:bg-brand";

/**
 * 가입 2단계(정보 입력) → 3단계(환영). 3단계는 라우트를 옮기지 않고 이 컴포넌트의 상태로 보여 준다(D-82).
 * 온보딩이 끝난 뒤 /onboarding을 다시 요청하면 middleware가 /me로 보내므로, 환영 화면을 띄운 동안에는
 * router.refresh/replace를 부르지 않고 사용자가 버튼을 누를 때만 이동한다.
 */
export function OnboardingForm({ terms, verifiedPhone, next, phoneRequired, defaultName }: {
  terms: Term[]; verifiedPhone: string | null; next: string; phoneRequired: boolean; defaultName: string;
}) {
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  if (welcomeName !== null) return <Welcome name={welcomeName} next={next} />;
  return (
    <InfoStep
      terms={terms} verifiedPhone={verifiedPhone} phoneRequired={phoneRequired} defaultName={defaultName}
      onDone={setWelcomeName}
    />
  );
}

function InfoStep({ terms, verifiedPhone, phoneRequired, defaultName, onDone }: {
  terms: Term[]; verifiedPhone: string | null; phoneRequired: boolean; defaultName: string; onDone: (name: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState<string | null>(verifiedPhone);
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState("");
  const contactValid = krMobileSchema.safeParse(contact).success;
  const contactError = contact.length >= 10 && !contactValid;
  const [agreed, setAgreed] = useState<Set<string>>(new Set());

  const allRequired = terms.filter((t) => t.required).every((t) => agreed.has(t.code));
  const allChecked = terms.length > 0 && terms.every((t) => agreed.has(t.code));
  const toggle = (code: string, on: boolean) =>
    setAgreed((prev) => {
      const s = new Set(prev);
      if (on) s.add(code);
      else s.delete(code);
      return s;
    });

  const run = (fn: () => Promise<void>) => {
    setError(null);
    start(fn);
  };

  const canSubmit = !pending && (phoneRequired ? !!verified : contactValid) && allRequired && !!name.trim();

  return (
    <>
      <TopBar title="회원가입" />
      <Stepper steps={SIGNUP_STEPS} current={1} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          run(async () => {
            const r = await completeOnboarding({ displayName: name, agreed: [...agreed], contactPhone: phoneRequired ? undefined : contact });
            if (!r.ok) return setError(r.error.message);
            onDone(name.trim());
          });
        }}
        className="flex min-h-[calc(100dvh-9.5rem)] flex-col"
      >
        <div className="flex-1 px-6 pt-4 pb-8">
          <h2 className="text-heading font-extrabold break-keep text-ink">거의 다 됐어요!<br />정보를 알려주세요</h2>
          <p className="mt-2 text-caption break-keep text-ink-mute">
            {phoneRequired ? "예약·거래 안내를 받을 휴대폰 번호를 인증하고 약관에 동의해 주세요." : "담당자가 연락드릴 이름과 연락처를 알려 주세요."}
          </p>

          <div className="mt-8 space-y-8">
            <div>
              <label htmlFor="displayName" className={labelClass}>이름</label>
              <input
                id="displayName" value={name} maxLength={DISPLAY_NAME_MAX} autoComplete="name"
                onChange={(e) => setName(e.target.value)} disabled={pending}
                aria-describedby="displayName-hint" placeholder="이름을 입력해 주세요."
                className={cn(inputClass, "mt-3")}
              />
              <p id="displayName-hint" className="mt-2 text-caption break-keep text-ink-mute">
                {defaultName ? "카카오 프로필 이름을 불러왔어요. 예약자명으로 쓰이니 바꿔도 돼요." : "예약·상담 때 예약자명으로 쓰여요."}
              </p>
            </div>

            {phoneRequired ? (
              <section aria-labelledby="phone-title" className="space-y-3">
                <h3 id="phone-title" className={labelClass}>휴대폰 인증</h3>
                {verified ? (
                  <p className="flex items-center gap-2 rounded-control bg-brand-soft px-4 py-4 text-label font-semibold text-brand-ink">
                    <Check className="size-5" aria-hidden />인증 완료: {formatPhone(verified)}
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        id="phone" aria-label="휴대폰 번호" placeholder="휴대폰 번호"
                        inputMode="tel" autoComplete="tel" className={inputClass}
                        value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} disabled={pending}
                      />
                      <button
                        type="button" className={sideButtonClass} disabled={pending || phoneInput.length < 10}
                        onClick={() => run(async () => {
                          const r = await sendPhoneOtp({ phone: phoneInput });
                          if (r.ok) setSentTo(r.data.phone);
                          else setError(r.error.message);
                        })}
                      >
                        {sentTo ? "재전송" : "인증번호"}
                      </button>
                    </div>
                    {sentTo && (
                      <div className="flex gap-2">
                        <input
                          id="phone-otp" aria-label="인증번호" placeholder="인증번호 6자리"
                          inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={cn(inputClass, "tabular-nums")}
                          value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} disabled={pending}
                        />
                        <button
                          type="button" className={sideButtonClass} disabled={pending || otp.length !== 6}
                          onClick={() => run(async () => {
                            const r = await verifyPhoneOtp({ phone: sentTo, token: otp });
                            if (r.ok) setVerified(sentTo);
                            else setError(r.error.message);
                          })}
                        >
                          확인
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : (
              <div>
                <label htmlFor="contactPhone" className={labelClass}>연락처(휴대폰)</label>
                <input
                  id="contactPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000"
                  value={contact} onChange={(e) => setContact(e.target.value)} disabled={pending}
                  aria-invalid={contactError} aria-describedby={contactError ? "contactPhone-err contactPhone-hint" : "contactPhone-hint"}
                  className={cn(inputClass, "mt-3 tabular-nums")}
                />
                {contactError && <p id="contactPhone-err" className="mt-2 text-caption font-semibold text-up">휴대폰 번호 형식을 확인해 주세요.</p>}
                <p id="contactPhone-hint" className="mt-2 text-caption break-keep text-ink-mute">담당자가 티타임·거래 확인 전화를 드리는 번호예요.</p>
              </div>
            )}

            <section aria-labelledby="terms-title">
              <h3 id="terms-title" className="sr-only">약관 동의</h3>
              <label className="pressable flex min-h-14 cursor-pointer items-center gap-3 rounded-control bg-fill px-4 py-3 text-subhead font-bold text-ink">
                <Checkbox
                  className={checkClass} checked={allChecked} disabled={pending}
                  onCheckedChange={(v) => setAgreed(v ? new Set(terms.map((t) => t.code)) : new Set())}
                />
                전체 동의
              </label>
              <ul className="mt-1">
                {terms.map((t) => (
                  <li key={t.code}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-label text-ink-sub">
                      <Checkbox className={checkClass} checked={agreed.has(t.code)} disabled={pending} onCheckedChange={(v) => toggle(t.code, v === true)} />
                      <span className="min-w-0 break-keep">
                        <span className={t.required ? "font-semibold text-brand-ink" : "text-ink-mute"}>{t.required ? "[필수]" : "[선택]"}</span> {t.title}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="mt-8 text-center text-tiny break-keep text-ink-faint">
            Googolf는 주민등록번호·신분증·인감 등 고유식별정보를 수집하지 않습니다.
          </p>
        </div>

        <div className="sticky bottom-0 bg-surface px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {error && <p role="alert" className="mb-3 rounded-control bg-fill px-4 py-3 text-caption font-semibold text-up">{error}</p>}
          <button type="submit" disabled={!canSubmit} className={cn(primaryButtonClass, "w-full")}>
            {pending ? "처리 중…" : "가입 완료"}
          </button>
        </div>
      </form>
    </>
  );
}

function Welcome({ name, next }: { name: string; next: string }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const links = welcomeLinks(next);

  // 화면이 바뀐 것을 스크린 리더에 알리고 키보드 초점을 새 화면 머리로 옮긴다
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);

  const go = (href: string) => {
    setMoving(true);
    router.replace(href as never);
    router.refresh();
  };

  return (
    <>
      <TopBar title="회원가입" />
      <Stepper steps={SIGNUP_STEPS} current={2} />
      <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col">
        <main className="enter-fade flex flex-1 flex-col items-center px-6 pt-4 pb-6 text-center">
          <span aria-hidden className="pop-in flex size-16 items-center justify-center rounded-full bg-brand-soft">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand text-white">
              <Check className="size-7" strokeWidth={3} />
            </span>
          </span>
          <h2
            ref={headingRef} tabIndex={-1}
            className="mt-5 text-display font-extrabold break-keep text-ink outline-none [overflow-wrap:anywhere]"
          >
            {name}님, 환영합니다!
          </h2>
          <p className="mt-2 max-w-[340px] text-label break-keep text-ink-sub">
            Googolf 회원이 되신 것을 환영해요. 이제 시세 확인부터 회원권 거래 상담까지 이용하실 수 있어요.
          </p>

          <Link
            href="/market/mypage/coupons"
            className="pressable mt-6 flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 text-left hover:bg-fill/60"
          >
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <TicketPercent className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-tiny font-semibold text-ink-mute">가입 혜택 · 미리보기</span>
              <span className="mt-0.5 block text-label font-bold break-keep text-ink">첫 거래 수수료 20% 할인 쿠폰</span>
                          </span>
            <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
          </Link>
        </main>

        <div className="sticky bottom-0 space-y-2 bg-surface px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" disabled={moving} onClick={() => go(links.browse)} className={cn(primaryButtonClass, "w-full")}>
            회원권 둘러보기
          </button>
          {links.resume && (
            <button type="button" disabled={moving} onClick={() => go(links.resume!)} className={cn(secondaryButtonClass, "w-full")}>
              하던 일 이어서 하기
            </button>
          )}
          <button
            type="button" disabled={moving} onClick={() => go(links.profile)}
            className="pressable flex h-11 w-full items-center justify-center text-label font-semibold text-ink-mute disabled:opacity-40"
          >
            내 정보로 이동
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPhone } from "@/lib/domain/phone";
import { completeOnboarding, sendPhoneOtp, verifyPhoneOtp } from "./actions";

type Term = { code: string; title: string; required: boolean };

export function OnboardingForm({ terms, verifiedPhone, next, phoneRequired }: {
  terms: Term[]; verifiedPhone: string | null; next: string; phoneRequired: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState<string | null>(verifiedPhone);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState<Set<string>>(new Set());

  const allRequired = terms.filter((t) => t.required).every((t) => agreed.has(t.code));
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

  const allChecked = terms.length > 0 && terms.every((t) => agreed.has(t.code));

  return (
    <div className="flex flex-col gap-10">
      {phoneRequired && <section className="space-y-4" aria-labelledby="phone-title">
        <h2 id="phone-title" className="text-eyebrow tracking-tight">휴대폰 인증</h2>
        {verified ? (
          <p className="rounded-tile bg-secondary px-5 py-4 text-body text-secondary-foreground">인증 완료: {formatPhone(verified)}</p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <FloatingInput
                id="phone" label="휴대폰 번호" className="flex-1"
                inputMode="tel" autoComplete="tel" aria-label="휴대폰 번호"
                value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} disabled={pending}
              />
              <Button
                type="button" variant="secondary" className="h-14" disabled={pending || phoneInput.length < 10}
                onClick={() => run(async () => {
                  const r = await sendPhoneOtp({ phone: phoneInput });
                  if (r.ok) setSentTo(r.data.phone);
                  else setError(r.error.message);
                })}
              >
                {sentTo ? "재전송" : "인증번호"}
              </Button>
            </div>
            {sentTo && (
              <div className="flex items-start gap-2">
                <FloatingInput
                  id="phone-otp" label="인증번호" className="flex-1"
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="인증번호"
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} disabled={pending}
                />
                <Button
                  type="button" className="h-14" disabled={pending || otp.length !== 6}
                  onClick={() => run(async () => {
                    const r = await verifyPhoneOtp({ phone: sentTo, token: otp });
                    if (r.ok) setVerified(sentTo);
                    else setError(r.error.message);
                  })}
                >
                  확인
                </Button>
              </div>
            )}
          </>
        )}
      </section>}

      <section className="space-y-4" aria-labelledby="profile-title">
        <h2 id="profile-title" className="text-eyebrow tracking-tight">예약자 정보</h2>
        <FloatingInput
          id="displayName" label="이름(예약자명)" autoComplete="name" maxLength={50}
          value={name} onChange={(e) => setName(e.target.value)} disabled={pending}
        />
      </section>

      <section className="space-y-4" aria-labelledby="terms-title">
        <h2 id="terms-title" className="text-eyebrow tracking-tight">약관 동의</h2>
        <div className="overflow-hidden rounded-tile bg-section">
          <label className="flex min-h-14 cursor-pointer items-center gap-3 px-5 py-3 text-body font-semibold">
            <Checkbox
              className="size-5"
              checked={allChecked}
              onCheckedChange={(v) => setAgreed(v ? new Set(terms.map((t) => t.code)) : new Set())}
            />
            전체 동의
          </label>
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {terms.map((t) => (
              <li key={t.code}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-5 py-3 text-small">
                  <Checkbox className="size-5" checked={agreed.has(t.code)} onCheckedChange={(v) => toggle(t.code, v === true)} />
                  <span>
                    <span className={t.required ? "text-primary" : "text-muted-foreground"}>{t.required ? "[필수]" : "[선택]"}</span> {t.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="space-y-4">
        {error && <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{error}</p>}
        <Button
          size="lg" disabled={pending || (phoneRequired && !verified) || !allRequired || !name.trim()}
          onClick={() => run(async () => {
            const r = await completeOnboarding({ displayName: name, agreed: [...agreed] });
            if (!r.ok) return setError(r.error.message);
            router.replace(next as never);
            router.refresh();
          })}
        >
          {pending ? "처리 중…" : "시작하기"}
        </Button>
      </div>
    </div>
  );
}

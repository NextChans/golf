"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div className="flex flex-col gap-6">
      {phoneRequired && <section className="space-y-3" aria-labelledby="phone-title">
        <h2 id="phone-title" className="font-semibold">1. 휴대폰 인증</h2>
        {verified ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-sm">인증 완료: {formatPhone(verified)}</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" aria-label="휴대폰 번호"
                value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} disabled={pending}
              />
              <Button
                type="button" variant="secondary" disabled={pending || phoneInput.length < 10}
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
              <div className="flex gap-2">
                <Input
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="인증번호 6자리" aria-label="인증번호"
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} disabled={pending}
                />
                <Button
                  type="button" disabled={pending || otp.length !== 6}
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

      <section className="space-y-3" aria-labelledby="profile-title">
        <h2 id="profile-title" className="font-semibold">{phoneRequired ? "2. 이름과 약관" : "이름과 약관"}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">이름(예약자명)</Label>
          <Input id="displayName" autoComplete="name" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 font-medium">
            <Checkbox
              checked={terms.length > 0 && terms.every((t) => agreed.has(t.code))}
              onCheckedChange={(v) => setAgreed(v ? new Set(terms.map((t) => t.code)) : new Set())}
            />
            전체 동의
          </label>
          {terms.map((t) => (
            <label key={t.code} className="flex items-center gap-2 text-sm">
              <Checkbox checked={agreed.has(t.code)} onCheckedChange={(v) => toggle(t.code, v === true)} />
              <span>{t.required ? "[필수]" : "[선택]"} {t.title}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

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
  );
}

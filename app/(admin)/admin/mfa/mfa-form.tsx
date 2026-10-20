"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { createClient } from "@/lib/supabase/client";
import { recordMfaVerified } from "./actions";

type Mode =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "error"; message: string };

export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setMode({ kind: "error", message: "OTP 정보를 불러오지 못했습니다." });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });

      // 이전에 등록을 끝내지 않은 factor는 정리하고 새로 등록한다
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Googolf 운영자" });
      if (enrolled.error) return setMode({ kind: "error", message: "OTP 등록을 시작하지 못했습니다." });
      setMode({ kind: "enroll", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })();
  }, []);

  if (mode.kind === "loading") return <div className="space-y-3" aria-live="polite"><span className="sr-only">불러오는 중…</span><div className="h-14 animate-pulse rounded-tile bg-section" /><div className="h-[52px] animate-pulse rounded-full bg-section" /></div>;
  if (mode.kind === "error") return <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{mode.message}</p>;

  const submit = () =>
    start(async () => {
      setError(null);
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
      if (error) return setError("코드가 올바르지 않습니다. 앱에 표시된 최신 코드를 입력해 주세요.");
      await recordMfaVerified(mode.kind === "enroll");
      router.replace("/admin");
      router.refresh();
    });

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {mode.kind === "enroll" && (
        <div className="space-y-4 rounded-tile-lg bg-section p-6 text-center">
          <p className="text-body">Google Authenticator 등 OTP 앱으로 QR 코드를 스캔하세요.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Auth가 주는 data URL SVG */}
          <img src={mode.qr} alt="OTP 등록 QR 코드" className="mx-auto size-44 rounded-tile bg-white p-2" />
          <p className="text-micro text-muted-foreground">
            스캔이 안 되면 키 직접 입력: <code data-testid="totp-secret" className="break-all font-mono">{mode.secret}</code>
          </p>
        </div>
      )}
      <FloatingInput
        id="otp" label="6자리 코드" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
        className="[&_input]:tracking-[0.3em] [&_input]:tabular-nums"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
      {error && <p role="alert" className="rounded-tile bg-destructive/10 px-5 py-4 text-small text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="mt-3" disabled={pending || code.length !== 6}>{pending ? "확인 중…" : "확인"}</Button>
    </form>
  );
}

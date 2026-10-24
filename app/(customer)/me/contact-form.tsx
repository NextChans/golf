"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/site/field";
import { formatPhone, krMobileSchema } from "@/lib/domain/phone";
import { updateContactPhone } from "./actions";

/** 내 정보의 연락처 행. 번호가 없으면 입력을 바로 요구하고, 있으면 "변경"으로 편집한다. */
export function ContactRow({ phone, verified, editable }: { phone: string | null; verified: boolean; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!phone && editable);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = krMobileSchema.safeParse(value).success;

  if (!editing) {
    return (
      <div className="flex min-h-14 items-center justify-between gap-4 px-6 py-4">
        <dt className="text-body text-muted-foreground">연락처</dt>
        <dd className="flex items-center gap-3 text-right text-body tabular-nums">
          <span data-testid="contact-phone">{phone ? formatPhone(phone) : "미입력"}</span>
          {editable && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>변경</Button>
          )}
          {!editable && verified && <span className="text-small text-muted-foreground">인증됨</span>}
        </dd>
      </div>
    );
  }

  return (
    <div id="contact" className="space-y-3 px-6 py-5">
      <dt className="text-body font-semibold">연락처</dt>
      <dd className="space-y-3">
        {!phone && <p className="text-small text-muted-foreground">회원권 상담 전에 확인 전화를 받을 휴대폰 번호를 입력해 주세요.</p>}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await updateContactPhone({ phone: value });
              if (!r.ok) return setError(r.error.message);
              setEditing(false);
              setValue("");
              router.refresh();
            });
          }}
        >
          <FloatingInput
            id="contactPhoneEdit" label="연락처(휴대폰)" type="tel" inputMode="tel" autoComplete="tel"
            value={value} onChange={(e) => setValue(e.target.value)} disabled={pending}
            error={value.length >= 10 && !valid ? "휴대폰 번호 형식을 확인해 주세요." : undefined}
          />
          {error && <p role="alert" className="text-small text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !valid}>{pending ? "저장 중…" : "저장"}</Button>
            {phone && <Button type="button" variant="secondary" onClick={() => setEditing(false)}>취소</Button>}
          </div>
        </form>
      </dd>
    </div>
  );
}

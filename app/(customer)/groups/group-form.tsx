"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingInput, optionTileClass } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { REGION_LABEL, REGIONS, type Region } from "@/lib/domain/course/schema";
import {
  GROUP_TYPE_LABEL, GROUP_TYPES, JOIN_POLICIES, JOIN_POLICY_LABEL, type GroupJoinPolicy, type GroupType,
} from "@/lib/domain/community/labels";
import { createGroup, updateGroup, type FormState } from "./actions";
import { Chevron, FieldError, fieldLabelClass, selectClass, textareaClass } from "./fields";

export type GroupFormValues = {
  name: string; type: GroupType | ""; region: Region | ""; description: string;
  joinPolicy: GroupJoinPolicy; capacity: number; openChatUrl: string;
};

const JOIN_HINT: Record<GroupJoinPolicy, string> = { open: "누구나 바로 멤버", approval: "운영진이 확인 후 승인" };

/** 모임 만들기·수정 폼. 만들기는 렌더 시 발급한 멱등키(D-10), 수정은 expectedVersion을 보낸다. */
export function GroupForm(props:
  | { mode: "create"; idempotencyKey: string; initial?: undefined; groupId?: undefined; version?: undefined }
  | { mode: "edit"; groupId: string; version: number; initial: GroupFormValues; idempotencyKey?: undefined }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(props.mode === "create" ? createGroup : updateGroup, {});
  const init = props.initial;
  const [type, setType] = useState<GroupType | "">(init?.type ?? "");
  const [joinPolicy, setJoinPolicy] = useState<GroupJoinPolicy>(init?.joinPolicy ?? "approval");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.groupId) router.replace(`/groups/${state.groupId}`);
  }, [state.groupId, router]);

  const done = pending || !!state.groupId;
  const submitLabel = props.mode === "create" ? "모임 만들기" : "저장";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {props.mode === "create" ? (
        <input type="hidden" name="idempotencyKey" value={props.idempotencyKey} />
      ) : (
        <>
          <input type="hidden" name="groupId" value={props.groupId} />
          <input type="hidden" name="expectedVersion" value={props.version} />
        </>
      )}
      <FloatingInput
        id="name" name="name" label="모임 이름" maxLength={40} required defaultValue={init?.name}
        error={errors.name}
      />

      {props.mode === "create" ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 px-1 text-small font-medium">모임 유형</legend>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3" role="radiogroup" aria-label="모임 유형">
            {GROUP_TYPES.map((t) => (
              <label
                key={t}
                className={cn(optionTileClass(type === t), "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/30")}
              >
                <input type="radio" name="type" value={t} className="sr-only" checked={type === t} onChange={() => setType(t)} />
                <span className={cn("text-small", type === t && "font-semibold")}>{GROUP_TYPE_LABEL[t]}</span>
              </label>
            ))}
          </div>
          <FieldError message={errors.type} />
        </fieldset>
      ) : (
        <p className="px-1 text-small text-muted-foreground">모임 유형: {init.type ? GROUP_TYPE_LABEL[init.type] : "-"} (변경할 수 없습니다)</p>
      )}

      <div className="space-y-1.5">
        <div className="relative">
          <select
            id="region" name="region" defaultValue={init?.region ?? ""} className={selectClass}
            aria-invalid={errors.region ? true : undefined}
          >
            <option value="" disabled>선택해 주세요</option>
            {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
          </select>
          <label htmlFor="region" className={fieldLabelClass}>활동 지역</label>
          <Chevron />
        </div>
        <FieldError message={errors.region} />
      </div>

      <div className="space-y-1.5">
        <div className="relative">
          <textarea
            id="description" name="description" maxLength={2000} rows={5} defaultValue={init?.description}
            placeholder="모임 성격, 주로 가는 골프장, 구력·핸디캡 등(10자 이상)"
            aria-invalid={errors.description ? true : undefined} className={textareaClass}
          />
          <label htmlFor="description" className={fieldLabelClass}>모임 소개</label>
        </div>
        <FieldError message={errors.description} />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 px-1 text-small font-medium">가입 방식</legend>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="가입 방식">
          {JOIN_POLICIES.map((p) => (
            <label
              key={p}
              className={cn(optionTileClass(joinPolicy === p), "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/30")}
            >
              <input type="radio" name="joinPolicy" value={p} className="sr-only" checked={joinPolicy === p} onChange={() => setJoinPolicy(p)} />
              <span className={cn(joinPolicy === p && "font-semibold")}>{JOIN_POLICY_LABEL[p]}</span>
              <span className="mt-0.5 text-micro text-muted-foreground">{JOIN_HINT[p]}</span>
            </label>
          ))}
        </div>
        <FieldError message={errors.joinPolicy} />
      </fieldset>

      <FloatingInput
        id="capacity" name="capacity" label="정원" inputMode="numeric" suffix="명" defaultValue={String(init?.capacity ?? 100)}
        error={errors.capacity}
      />
      <FloatingInput
        id="openChatUrl" name="openChatUrl" label="오픈채팅 링크(선택)" inputMode="url" maxLength={200}
        defaultValue={init?.openChatUrl} error={errors.openChatUrl}
      />
      <p className="-mt-2 px-1 text-micro text-muted-foreground">
        카카오톡 오픈채팅(https://open.kakao.com/…)만 입력할 수 있고, 가입한 멤버에게만 보입니다.
      </p>

      <div className="space-y-3 pt-4">
        {state.error && <p role="alert" className="text-center text-body text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={done}>{done ? "저장 중…" : submitLabel}</Button>
        <p className="text-center text-micro text-muted-foreground">
          골프와 관련된 모임만 만들 수 있습니다. 금칙어가 있으면 운영자 검수 후 공개됩니다.
        </p>
      </div>
    </form>
  );
}

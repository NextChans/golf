"use client";

import { useEffect, useState } from "react";
import { readJson, STORAGE_KEYS, writeJson } from "./storage";

const ITEMS = [
  { key: "quote", label: "관심 회원권 시세 알림", desc: "관심 회원권의 주간 시세가 바뀌면 알려 드려요." },
  { key: "deal", label: "거래 진행 알림", desc: "상담·계약·명의개서 단계가 바뀌면 알려 드려요." },
  { key: "report", label: "주간 시세 리포트", desc: "매주 월요일 지역별 시세 요약을 보내 드려요." },
  { key: "marketing", label: "혜택·이벤트 알림(선택)", desc: "쿠폰과 이벤트 소식을 보내 드려요. 언제든 끌 수 있어요." },
] as const;
type Key = (typeof ITEMS)[number]["key"];
const DEFAULTS: Record<Key, boolean> = { quote: true, deal: true, report: false, marketing: false };

/** 알림 설정(미리보기: 이 브라우저에만 저장). 마케팅 수신은 기본 꺼짐(정보통신망법 사전 동의) */
export function SettingsForm() {
  const [v, setV] = useState(DEFAULTS);
  useEffect(() => {
    setV({ ...DEFAULTS, ...readJson<Partial<Record<Key, boolean>>>(STORAGE_KEYS.settings, {}) });
  }, []);
  const set = (k: Key, on: boolean) => {
    const next = { ...v, [k]: on };
    setV(next);
    writeJson(STORAGE_KEYS.settings, next);
  };
  return (
    <ul className="divide-y divide-line">
      {ITEMS.map((it) => (
        <li key={it.key} className="flex items-center justify-between gap-4 px-6 py-5">
          <span>
            <span id={`s-${it.key}`} className="block text-label font-bold text-ink">{it.label}</span>
            <span className="text-caption text-ink-mute">{it.desc}</span>
          </span>
          <button
            type="button" role="switch" aria-checked={v[it.key]} aria-labelledby={`s-${it.key}`}
            onClick={() => set(it.key, !v[it.key])}
            className="relative h-8 w-[52px] shrink-0 rounded-full bg-line transition-colors aria-checked:bg-brand"
          >
            <span aria-hidden className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${v[it.key] ? "translate-x-5" : ""}`} />
          </button>
        </li>
      ))}
    </ul>
  );
}

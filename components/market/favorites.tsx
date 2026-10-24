"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { readJson, STORAGE_KEYS, writeJson } from "./storage";

const EMPTY: string[] = [];
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function snapshot(): string[] {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(STORAGE_KEYS.favorites); } catch { /* 접근 불가 */ }
  if (raw !== cache.raw) cache = { raw, ids: readJson<string[]>(STORAGE_KEYS.favorites, EMPTY) };
  return cache.ids;
}
function subscribe(cb: () => void) {
  window.addEventListener("googolf-storage", cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener("googolf-storage", cb); window.removeEventListener("storage", cb); };
}

/** 관심 회원권 id 목록(목업: 이 브라우저에만 저장) */
export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const toggle = useCallback((id: string) => {
    const cur = snapshot();
    writeJson(STORAGE_KEYS.favorites, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);
  return { ids, toggle };
}

export function FavoriteButton({ id, name, className }: { id: string; name: string; className?: string }) {
  const { ids, toggle } = useFavorites();
  const on = ids.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${name} 관심 회원권`}
      onClick={() => toggle(id)}
      className={cn("pressable flex size-11 items-center justify-center", className)}
    >
      <Heart className={cn("size-7", on ? "fill-up text-up" : "text-ink")} strokeWidth={2} aria-hidden />
    </button>
  );
}

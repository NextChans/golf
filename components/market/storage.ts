"use client";

/**
 * 브라우저 저장소 래퍼(목업 단계의 관심 회원권·팝업 숨김·설정).
 * 사생활 보호 모드 등에서 localStorage 접근이 막혀도 화면이 깨지지 않도록 모든 접근을 try/catch.
 * 실데이터 연결 때 관심 회원권·설정은 DB로 옮긴다(로그인 고객 기준).
 */
export const STORAGE_KEYS = {
  favorites: "googolf.market.favorites",
  couponSheetHidden: "googolf.market.couponSheetHidden",
  noticeHiddenOn: "googolf.market.noticeHiddenOn",
  welcomed: "googolf.market.welcomed",
  prefs: "googolf.market.prefs",
  settings: "googolf.market.settings",
} as const;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("googolf-storage", { detail: key }));
  } catch {
    // 저장 실패는 무시(다음 방문에 다시 보일 뿐)
  }
}

"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics(쿠키 없음). 개인정보 최소화:
 * - 운영자 화면(/admin)은 수집하지 않는다
 * - 쿼리스트링(next=, error= 등)은 제거하고 경로만 보낸다
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return null;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}

/**
 * OAuth 콜백으로 돌아올 origin을 고른다.
 * preview 배포에서 로그인하면 PKCE 쿠키가 그 preview 도메인에 저장되므로, 콜백도 같은 도메인이어야 한다.
 * Host 헤더는 위조될 수 있어 허용 목록(운영 URL, 이 배포의 Vercel URL, 로컬)만 쓰고 나머지는 운영 URL로 대체한다.
 * (Supabase Auth의 Redirect URLs 허용 목록이 한 번 더 검증한다.)
 */
export function pickOrigin(input: {
  requestHost: string | null;
  requestProto: string | null;
  siteUrl: string;
  vercelUrls: Array<string | undefined>;
}): string {
  const site = new URL(input.siteUrl);
  const host = input.requestHost?.trim().toLowerCase();
  if (!host) return site.origin;

  const allowed = new Set<string>([site.host.toLowerCase(), "localhost:3000", "127.0.0.1:3000"]);
  for (const u of input.vercelUrls) if (u) allowed.add(u.toLowerCase());
  if (!allowed.has(host)) return site.origin;

  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = isLocal ? (input.requestProto === "https" ? "https" : "http") : "https";
  return `${proto}://${host}`;
}

import type { NextConfig } from "next";

// 보안 헤더. CSP는 M3에서 화면이 늘어난 뒤 nonce 기반으로 강화한다.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  // forbidden()/unauthorized() 사용(app/forbidden.tsx)
  experimental: { authInterrupts: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // D-87: 앱 홈은 루트(/). 예전 앱 홈 주소와 제거된 부킹 화면은 홈으로 보낸다(쿼리는 그대로 전달된다).
  // 임시(307)로 둬서 나중에 경로를 다시 쓰더라도 브라우저 캐시에 남지 않게 한다.
  async redirects() {
    return [
      { source: "/market", destination: "/", permanent: false },
      { source: "/bookings", destination: "/", permanent: false },
      { source: "/bookings/:path*", destination: "/", permanent: false },
      { source: "/admin/bookings", destination: "/admin", permanent: false },
      { source: "/admin/bookings/:path*", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;

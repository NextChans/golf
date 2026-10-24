import type { Metadata, Viewport } from "next";
import "./globals.css";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";

export const metadata: Metadata = {
  title: { default: "Googolf", template: "%s · Googolf" },
  description: "골프 회원권 시세 조회부터 매매 상담, 골프 모임까지. Googolf",
  icons: {
    icon: [
      { url: "/brand/googolf-mark.svg", type: "image/svg+xml" },
      { url: "/brand/icons/googolf-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icons/googolf-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1512" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh font-sans">
        {children}
        <VercelAnalytics />
      </body>
    </html>
  );
}

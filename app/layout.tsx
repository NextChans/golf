import type { Metadata, Viewport } from "next";
import "./globals.css";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";

export const metadata: Metadata = {
  title: { default: "Googolf", template: "%s · Googolf" },
  description: "골프 부킹과 회원권 상담을 온라인으로. Googolf",
  icons: { icon: "/brand/googolf-mark.svg" },
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

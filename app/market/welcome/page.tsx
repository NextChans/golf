import type { Metadata } from "next";
import { Welcome } from "@/components/market/welcome";

export const metadata: Metadata = { title: "맞춤 회원권 찾기" };

export default function WelcomePage() {
  return <Welcome />;
}

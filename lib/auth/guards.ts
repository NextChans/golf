import "server-only";
import { forbidden, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toSession, type Session } from "./claims";

/** 서버 컴포넌트·Server Action용 가드. middleware와 독립적으로 다시 검사한다. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return toSession(data?.claims ?? null);
}

export async function requireCustomer(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "customer") redirect("/admin");
  // claim(onboarded)은 토큰 갱신 전까지 늦을 수 있으므로 DB로 최종 확인한다
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", session.userId).maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");
  return session;
}

export async function requireSignedInCustomer(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "customer") redirect("/admin");
  return session;
}

export async function requireStaff(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin" && session.role !== "owner") forbidden();
  if (session.passwordChangeRequired) redirect("/admin/password");
  if (session.aal !== "aal2") redirect("/admin/mfa");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireStaff();
  if (session.role !== "owner") forbidden();
  return session;
}

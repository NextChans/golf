import { createClient } from "@supabase/supabase-js";

// env는 global-setup에서 .env.local을 읽은 뒤에 참조해야 하므로 호출 시점에 읽는다
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 필요합니다(.env.local 또는 CI env).");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type E2EUsers = {
  customer: { email: string; password: string };
  owner: { email: string; password: string; newPassword: string };
};

/** 실행마다 새 계정(이메일에 타임스탬프). 로컬 DB에만 만든다. */
export async function createE2EUsers(): Promise<E2EUsers> {
  const admin = adminClient();
  const stamp = Date.now();
  const customer = { email: `e2e-customer-${stamp}@test.local`, password: "E2e-customer-pass-1" };
  const owner = { email: `e2e-owner-${stamp}@test.local`, password: "E2e-temp-pass-1234", newPassword: "E2e-owner-new-pass-5678" };

  const c = await admin.auth.admin.createUser({ email: customer.email, password: customer.password, email_confirm: true });
  if (c.error) throw c.error;
  // 테스트 픽스처: 역할을 Admin API로 직접 부여(운영에서는 set_staff_role/bootstrap_owner로만)
  const o = await admin.auth.admin.createUser({
    email: owner.email, password: owner.password, email_confirm: true,
    app_metadata: { role: "owner", password_change_required: true },
  });
  if (o.error) throw o.error;
  return { customer, owner };
}

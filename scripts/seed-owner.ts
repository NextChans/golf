/**
 * 최초 owner 계정 생성. owner가 이미 있으면 DB 함수가 거부한다.
 * 실행: OWNER_EMAIL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:owner
 * 임시 비밀번호는 한 번만 출력된다. 첫 로그인 시 비밀번호 변경과 OTP 등록이 강제된다.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;
if (!url || !serviceKey || !email) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_EMAIL가 필요합니다.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = `Gg${randomBytes(18).toString("base64url")}7`;

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { password_change_required: true },
});
if (error || !data.user) {
  console.error(`계정 생성 실패: ${error?.message}`);
  process.exit(1);
}

const { error: rpcError } = await admin.rpc("bootstrap_owner", { p_user_id: data.user.id });
if (rpcError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error(`owner 지정 실패(계정은 삭제함): ${rpcError.message} ${rpcError.details ?? ""}`);
  process.exit(1);
}

console.log(`owner 생성 완료: ${email}`);
console.log(`임시 비밀번호(한 번만 표시): ${password}`);

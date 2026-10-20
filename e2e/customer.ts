/**
 * E2E 고객/제안 픽스처(테스트 전용, 로컬 DB에만 쓴다).
 *
 * 고객은 카카오 OAuth로만 로그인하므로 브라우저 자동화가 불가능하다. 앱에 백도어를 두지 않고(D-41),
 * 카카오 로그인 + complete_onboarding이 만드는 DB 상태를 직접 재현한 뒤 비밀번호 grant로 세션을 받아
 * @supabase/ssr과 같은 형식의 쿠키를 브라우저 컨텍스트에 넣는다.
 */
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import pg from "pg";
import { adminClient } from "./fixtures";

export type Customer = { userId: string; email: string; password: string; displayName: string };

type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
};

// spec 파일에서는 global-setup의 env 로딩이 공유되지 않으므로 호출 시점에 직접 읽는다
function env() {
  nextEnv.loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다(.env.local 또는 CI env).");
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  return { url, anonKey, databaseUrl };
}

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: env().databaseUrl });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

const rand = () => randomBytes(4).toString("hex");

/** 카카오 로그인 + 휴대폰 인증 + 온보딩까지 마친 고객. 테스트 픽스처 전용. */
/** opts.withContact=false: 연락처 없이 가입한 고객(D-48 이전 가입자·휴대폰 인증 생략) */
export async function createOnboardedCustomer(opts: { withContact?: boolean } = {}): Promise<Customer> {
  const withContact = opts.withContact ?? true;
  nextEnv.loadEnvConfig(process.cwd());
  const admin = adminClient();
  const email = `e2e-cust-${Date.now()}-${rand()}@test.local`;
  const password = `E2e-cust-${rand()}-pass`;
  const displayName = `E2E고객${randomInt(1000, 10000)}`;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  // 테스트 픽스처: 카카오 identity·인증된 휴대폰·온보딩 완료 상태를 DB에 직접 만든다
  // (운영에서는 카카오 OAuth, Auth phone_change OTP, public.complete_onboarding만 이 상태를 만든다)
  const phone = `8210${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
  await withDb(async (db) => {
    await db.query("begin");
    try {
      const kakaoSub = `e2e-${randomUUID()}`;
      await db.query(
        `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         values ($1, $2, jsonb_build_object('sub', $1::text), 'kakao', now(), now(), now())`,
        [kakaoSub, userId],
      );
      await db.query(
        `update auth.users
            set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                  || '{"provider":"kakao","providers":["email","kakao"],"onboarded":true}'::jsonb,
                phone = $2,
                phone_confirmed_at = now()
          where id = $1`,
        [userId, phone],
      );
      await db.query(
        `insert into public.profiles (id, display_name, phone, phone_verified_at, onboarded_at)
         values ($1, $2, case when $4 then '+' || $3 end, case when $4 then now() end, now())`,
        [userId, displayName, phone, withContact],
      );
      await db.query("commit");
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  });

  return { userId, email, password, displayName };
}

/** 비밀번호 grant로 로그인해 @supabase/ssr이 실제로 설정하는 쿠키(이름·청크·base64 인코딩)를 그대로 만든다. */
export async function customerCookies(c: Customer): Promise<PlaywrightCookie[]> {
  const { url, anonKey } = env();
  const captured: Array<{ name: string; value: string }> = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (toSet) => {
        captured.push(...toSet.map(({ name, value }) => ({ name, value })));
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: c.email, password: c.password });
  if (error) throw error;
  // setAll은 비동기로 호출될 수 있으므로 한 틱 양보한다
  await new Promise((r) => setTimeout(r, 0));
  if (captured.length === 0) throw new Error("세션 쿠키가 만들어지지 않았습니다.");

  // 같은 이름이 여러 번 들어오면 마지막 값을 쓰고, 빈 값(청크 삭제)은 제외한다
  const latest = new Map<string, string>();
  for (const { name, value } of captured) latest.set(name, value);
  return [...latest]
    .filter(([, value]) => value !== "")
    .map(([name, value]) => ({ name, value, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const }));
}

export async function loginAsCustomer(context: BrowserContext, c: Customer): Promise<void> {
  await context.addCookies(await customerCookies(c));
}

let cachedAdmin: string | null = null;

/** 운영자 계정(이메일 provider, role=admin). 프로세스 안에서 재사용한다. 테스트 픽스처 전용. */
async function ensureAdmin(): Promise<string> {
  if (cachedAdmin) return cachedAdmin;
  nextEnv.loadEnvConfig(process.cwd());
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email: `e2e-admin-${Date.now()}-${rand()}@test.local`,
    password: `E2e-admin-${rand()}-pass`,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (created.error) throw created.error;
  const adminId = created.data.user.id;
  // set_staff_role이 만드는 profiles 행을 대신 만든다
  await withDb((db) =>
    db.query(`insert into public.profiles (id, display_name) values ($1, 'E2E 운영자') on conflict (id) do nothing`, [adminId]),
  );
  cachedAdmin = adminId;
  return adminId;
}

/** 운영자로 배정 → 제안까지 진행해 고객이 볼 제안을 만든다. */
export async function seedProposal(
  requestId: string,
  opts: { greenFee?: number; validMinutes?: number; teeTimeDaysAhead?: number } = {},
): Promise<{ proposalId: string; adminId: string }> {
  const { greenFee = 180_000, validMinutes = 120, teeTimeDaysAhead = 7 } = opts;
  const adminId = await ensureAdmin();
  const claims = JSON.stringify({
    sub: adminId,
    role: "authenticated",
    aal: "aal2",
    app_metadata: { role: "admin", providers: ["email"] },
  });

  const proposalId = await withDb(async (db) => {
    await db.query("begin");
    try {
      const { rows } = await db.query<{ version: number }>(
        "select version from public.booking_requests where id = $1",
        [requestId],
      );
      if (!rows[0]) throw new Error(`booking request not found: ${requestId}`);
      const version = rows[0].version;
      await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await db.query("set local role authenticated");
      await db.query("select public.assign_booking($1, $2, $3)", [requestId, adminId, version]);
      const res = await db.query<{ id: string }>(
        `select id from public.propose_booking($1, $2, now() + make_interval(days => $3), $4, $5)`,
        [requestId, version + 1, teeTimeDaysAhead, greenFee, validMinutes],
      );
      await db.query("commit");
      return res.rows[0]!.id;
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  });
  return { proposalId, adminId };
}

export async function getBookingStatus(requestId: string): Promise<string> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ status: string }>(
      "select status::text as status from public.booking_requests where id = $1",
      [requestId],
    );
    if (!rows[0]) throw new Error(`booking request not found: ${requestId}`);
    return rows[0].status;
  });
}

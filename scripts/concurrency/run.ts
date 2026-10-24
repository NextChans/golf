/**
 * 동시성 검증: 두 커넥션에서 같은 대상에 동시에 상태 함수를 호출해 정확히 1건만 성공하는지 확인한다.
 *   (f) 같은 거래에 대한 동시 start_deal(같은 version으로 두 운영자가 동시에 전이)
 *   (g) 같은 매물에 대한 동시 start_deal(선점)
 *   (h) 알림 발송기 두 개의 동시 claim_notifications(같은 알림을 두 번 잡지 않음 = 중복 발송 없음)
 * 기호는 BRIEF.md 테스트 목록을 따른다. (f)는 원래 부킹 동시 accept_proposal이었으나 부킹 DB 제거(D-88)로
 * 같은 성질(같은 행에 대한 동시 전이는 1건만 성공)을 회원권 거래로 검증한다.
 *
 * 실행: pnpm test:concurrency   (로컬 supabase start 필요)
 * 환경변수: DATABASE_URL(기본 로컬), ITERATIONS(기본 50)
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ITERATIONS = Number(process.env.ITERATIONS ?? 50);
const PRODUCT_ID = "00000000-0000-4000-b000-000000000001"; // seed.sql

type Role = "customer" | "admin";
type Actor = { id: string; role: Role };

const claims = (actor: Actor) =>
  JSON.stringify({
    sub: actor.id,
    role: "authenticated",
    aal: actor.role === "admin" ? "aal2" : "aal1",
    app_metadata: { role: actor.role },
  });

async function createUser(db: pg.Client, role: Role): Promise<Actor> {
  const id = randomUUID();
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
             jsonb_build_object('provider', 'email', 'role', $3::text), '{}'::jsonb, now(), now())`,
    [id, `race-${id}@test.local`, role],
  );
  await db.query(
    `insert into public.profiles (id, display_name, phone, phone_verified_at, onboarded_at)
     values ($1, 'race', '+821000000000', now(), now())`,
    [id],
  );
  return { id, role };
}

/** 인증된 API 요청과 같은 조건(role=authenticated, JWT claims)으로 한 트랜잭션 안에서 실행한다. */
async function asActor<T>(db: pg.Client, actor: Actor, sql: string, params: unknown[]): Promise<T> {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims(actor)]);
    await db.query("set local role authenticated");
    const { rows } = await db.query(sql, params);
    await db.query("commit");
    return rows[0] as T;
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
}

/** 두 커넥션에서 동시에 실행. 각 커넥션은 claims 설정까지 마친 뒤 같은 순간에 본 호출을 보낸다. */
async function race(
  [c1, c2]: [pg.Client, pg.Client],
  calls: [{ actor: Actor; sql: string; params: unknown[] }, { actor: Actor; sql: string; params: unknown[] }],
) {
  const prepare = async (db: pg.Client, actor: Actor) => {
    await db.query("begin");
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims(actor)]);
    await db.query("set local role authenticated");
  };
  await Promise.all([prepare(c1, calls[0].actor), prepare(c2, calls[1].actor)]);

  const run = async (db: pg.Client, call: (typeof calls)[number]) => {
    try {
      await db.query(call.sql, call.params);
      await db.query("commit");
      return { ok: true as const };
    } catch (err) {
      await db.query("rollback");
      const e = err as { code?: string; message?: string };
      return { ok: false as const, code: e.code, message: e.message };
    }
  };
  return Promise.all([run(c1, calls[0]), run(c2, calls[1])]);
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function transitionRace(setup: pg.Client, conns: [pg.Client, pg.Client], admin: Actor) {
  // 매물이 없는 매도 상담: 매물 선점과 무관하게 같은 거래 행의 version 경쟁만 본다
  const customer = await createUser(setup, "customer");
  const deal = await asActor<{ id: string }>(
    setup, customer,
    "select id from public.create_deal_inquiry($1, 'sell', null, $2, 170000000, null, null)",
    [randomUUID(), PRODUCT_ID],
  );
  const admin2 = await createUser(setup, "admin");

  // 두 운영자가 같은 화면(version 1)에서 동시에 협의 시작
  const sql = "select public.start_deal($1, 1)";
  const results = await race(conns, [
    { actor: admin, sql, params: [deal.id] },
    { actor: admin2, sql, params: [deal.id] },
  ]);

  const ok = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok);
  assert(ok === 1, `transition: 성공 ${ok}건 (기대 1건) ${JSON.stringify(results)}`);
  assert(
    failures.every((f) => f.code === "GB409" && f.message === "version_conflict"),
    `transition: 실패 사유가 version_conflict가 아님 ${JSON.stringify(failures)}`,
  );

  const { rows } = await setup.query(
    `select d.status::text as status, d.version,
            (select count(*)::int from public.deal_events where deal_id = d.id and to_status = 'negotiating') as events
       from public.membership_deals d where d.id = $1`,
    [deal.id],
  );
  assert(
    rows[0].status === "negotiating" && rows[0].version === 2 && rows[0].events === 1,
    `transition: 최종 상태 불일치 ${JSON.stringify(rows[0])}`,
  );
}

async function listingRace(setup: pg.Client, conns: [pg.Client, pg.Client], admin: Actor) {
  const { rows: listingRows } = await setup.query(
    `insert into public.membership_listings (product_id, asking_price, status) values ($1, 300000000, 'listed') returning id`,
    [PRODUCT_ID],
  );
  const listingId: string = listingRows[0].id;
  const [buyer1, buyer2] = [await createUser(setup, "customer"), await createUser(setup, "customer")];
  const inquiry = (buyer: Actor) =>
    asActor<{ id: string }>(
      setup, buyer,
      "select id from public.create_deal_inquiry($1, 'buy', $2, null, null, null, null)",
      [randomUUID(), listingId],
    );
  const [d1, d2] = [await inquiry(buyer1), await inquiry(buyer2)];

  // 서로 다른 거래 2건이 같은 매물을 동시에 선점 시도
  const sql = "select public.start_deal($1, 1)";
  const results = await race(conns, [
    { actor: admin, sql, params: [d1.id] },
    { actor: admin, sql, params: [d2.id] },
  ]);

  const ok = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok);
  assert(ok === 1, `listing: 성공 ${ok}건 (기대 1건) ${JSON.stringify(results)}`);
  assert(
    failures.every((f) => f.code === "GB409" && f.message === "listing_unavailable"),
    `listing: 실패 사유가 listing_unavailable이 아님 ${JSON.stringify(failures)}`,
  );

  const { rows } = await setup.query(
    `select l.status::text as status,
            (select count(*)::int from public.membership_deals where listing_id = l.id and status = 'negotiating') as negotiating
       from public.membership_listings l where l.id = $1`,
    [listingId],
  );
  assert(rows[0].status === "reserved" && rows[0].negotiating === 1, `listing: 최종 상태 불일치 ${JSON.stringify(rows[0])}`);
}

async function claimRace(setup: pg.Client, conns: [pg.Client, pg.Client]) {
  const batch = randomUUID();
  // 다른 시나리오·이전 실행이 남긴 대기 알림(lease 만료 sending 포함)보다 먼저 잡히도록 가장 이른 시각보다 앞에 넣는다
  // (claim은 next_attempt_at 순)
  const { rows: inserted } = await setup.query<{ id: string }>(
    `insert into public.notification_outbox (event_type, recipient_kind, channel, template_code, payload, dedupe_key, next_attempt_at)
     select 'race', 'admins', 'slack', 'ADMIN_DEAL_REQUESTED', '{}'::jsonb, $1 || ':' || g,
            least(now() - interval '1 day', (select min(next_attempt_at) from public.notification_outbox) - interval '1 minute')
       from generate_series(1, 10) g returning id::text`,
    [batch],
  );
  const ids = new Set(inserted.map((r) => r.id));

  const claim = async (db: pg.Client) => {
    await db.query("begin");
    await db.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    await db.query("set local role service_role");
    const { rows } = await db.query<{ id: string }>("select id::text from public.claim_notifications(100)");
    await db.query("commit");
    return rows.map((r) => r.id);
  };
  const [a, b] = await Promise.all([claim(conns[0]), claim(conns[1])]);

  const mine = [...a, ...b].filter((id) => ids.has(id));
  assert(new Set(mine).size === mine.length, `claim: 같은 알림을 두 발송기가 잡음 ${JSON.stringify({ a, b })}`);
  assert(mine.length === ids.size, `claim: ${mine.length}/${ids.size}건만 잡힘`);
  const { rows } = await setup.query<{ n: number }>(
    "select count(*)::int as n from public.notification_outbox where dedupe_key like $1 || ':%' and status = 'sending' and attempts = 1",
    [batch],
  );
  assert(rows[0]!.n === ids.size, `claim: 시도 횟수 불일치 ${JSON.stringify(rows[0])}`);
  // 정리: 잡은 행을 보낸 것으로 기록해 lease 만료 뒤 다음 실행의 claim에 끼어들지 않게 한다
  await setup.query(
    "update public.notification_outbox set status = 'sent', sent_at = now(), locked_at = null where dedupe_key like $1 || ':%'",
    [batch],
  );
}

async function main() {
  const setup = new pg.Client({ connectionString: DATABASE_URL });
  const conns: [pg.Client, pg.Client] = [
    new pg.Client({ connectionString: DATABASE_URL }),
    new pg.Client({ connectionString: DATABASE_URL }),
  ];
  await Promise.all([setup.connect(), ...conns.map((c) => c.connect())]);

  try {
    const admin = await createUser(setup, "admin");
    for (const [name, fn] of [
      ["(f) 같은 거래 동시 전이", transitionRace],
      ["(g) 동시 매물 선점", listingRace],
      ["(h) 동시 알림 claim", (s: pg.Client, c: [pg.Client, pg.Client]) => claimRace(s, c)],
    ] as const) {
      for (let i = 0; i < ITERATIONS; i++) await fn(setup, conns, admin);
      console.log(`PASS ${name}: ${ITERATIONS}회 모두 1건만 성공`);
    }
  } finally {
    await Promise.all([setup.end(), ...conns.map((c) => c.end())]);
  }
}

main().catch((err) => {
  console.error(`FAIL ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

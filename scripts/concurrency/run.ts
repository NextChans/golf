/**
 * 동시성 검증: 두 커넥션에서 같은 대상에 동시에 상태 함수를 호출해 정확히 1건만 성공하는지 확인한다.
 *   (f) 같은 부킹 요청에 대한 동시 accept_proposal
 *   (g) 같은 매물에 대한 동시 start_deal(선점)
 *
 * 실행: pnpm test:concurrency   (로컬 supabase start 필요)
 * 환경변수: DATABASE_URL(기본 로컬), ITERATIONS(기본 50)
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ITERATIONS = Number(process.env.ITERATIONS ?? 50);
const PRODUCT_ID = "00000000-0000-4000-b000-000000000001"; // seed.sql
const COURSE_ID = "00000000-0000-4000-a000-000000000001"; // seed.sql

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

async function acceptRace(setup: pg.Client, conns: [pg.Client, pg.Client], admin: Actor) {
  const customer = await createUser(setup, "customer");
  const req = await asActor<{ id: string }>(
    setup, customer,
    `select id from public.create_booking_request($1, $2, null, (now() at time zone 'Asia/Seoul')::date + 7,
       'part_1', null, null, 4, null, null)`,
    [randomUUID(), COURSE_ID],
  );
  await asActor(setup, admin, "select public.assign_booking($1, $2, 1)", [req.id, admin.id]);
  const proposal = await asActor<{ id: string }>(
    setup, admin, "select id from public.propose_booking($1, 2, now() + interval '3 days', 150000)", [req.id],
  );

  // 같은 고객이 두 탭에서 각자 다른 멱등키로 동시에 수락
  const sql = "select public.accept_proposal($1, $2, 3)";
  const results = await race(conns, [
    { actor: customer, sql, params: [randomUUID(), proposal.id] },
    { actor: customer, sql, params: [randomUUID(), proposal.id] },
  ]);

  const ok = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok);
  assert(ok === 1, `accept: 성공 ${ok}건 (기대 1건) ${JSON.stringify(results)}`);
  assert(failures.every((f) => f.code === "GB409"), `accept: 실패 코드가 GB409가 아님 ${JSON.stringify(failures)}`);

  const { rows } = await setup.query(
    `select r.status::text as status,
            (select count(*)::int from public.booking_proposals where request_id = r.id and status = 'accepted') as accepted
       from public.booking_requests r where r.id = $1`,
    [req.id],
  );
  assert(rows[0].status === "confirmed" && rows[0].accepted === 1, `accept: 최종 상태 불일치 ${JSON.stringify(rows[0])}`);
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
      ["(f) 동시 accept_proposal", acceptRace],
      ["(g) 동시 매물 선점", listingRace],
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

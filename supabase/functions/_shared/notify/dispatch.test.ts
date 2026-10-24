import { describe, expect, it, vi } from "vitest";
import { ConsoleAdapter, SlackWebhookAdapter, createAdapters, type AdapterSet } from "./adapters.ts";
import { deliver, runDispatch, sanitizeError } from "./dispatch.ts";
import { KNOWN_TEMPLATES, renderMessage } from "./templates.ts";
import { DeliveryError, type Adapter, type OutboxItem, type OutboxStore } from "./types.ts";

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 1, event_type: "group.meeting_created", recipient_kind: "customer", recipient_phone: "+821012345678",
  channel: "alimtalk", template_code: "GROUP_MEETING_CREATED", dedupe_key: "meeting:x:created:u1", attempts: 1,
  payload: { group_id: "g1", group_name: "주말 라운드", title: "11월 정모", starts_at: "2026-10-27T22:30:00Z" },
  ...over,
});

const ok = (channel: Adapter["channel"]): Adapter => ({ channel, name: "ok", send: vi.fn(async () => ({ messageId: `${channel}-id` })) });
const bad = (channel: Adapter["channel"], msg = "down"): Adapter => ({ channel, name: "bad", send: vi.fn(async () => { throw new DeliveryError(msg); }) });

function memoryStore(items: OutboxItem[], failResult: "failed" | "dead" = "failed") {
  const calls = { complete: [] as unknown[][], fail: [] as unknown[][] };
  const store: OutboxStore = {
    claim: vi.fn(async () => items),
    complete: vi.fn(async (...a) => { calls.complete.push(a); }),
    fail: vi.fn(async (...a) => { calls.fail.push(a); return failResult; }),
  };
  return { store, calls };
}

describe("deliver", () => {
  it("고객: 알림톡 성공", async () => {
    const adapters: AdapterSet = { alimtalk: ok("alimtalk"), sms: ok("sms"), slack: ok("slack") };
    expect(await deliver(item(), adapters, "https://g.app")).toEqual({ channel: "alimtalk", messageId: "alimtalk-id" });
    expect(adapters.sms.send).not.toHaveBeenCalled();
  });
  it("고객: 알림톡 실패 → SMS 대체 발송(N-02)", async () => {
    const adapters: AdapterSet = { alimtalk: bad("alimtalk"), sms: ok("sms"), slack: ok("slack") };
    expect(await deliver(item(), adapters, "https://g.app")).toEqual({ channel: "sms", messageId: "sms-id" });
  });
  it("고객: 둘 다 실패하면 두 오류를 함께 던진다", async () => {
    const adapters: AdapterSet = { alimtalk: bad("alimtalk", "a"), sms: bad("sms", "b"), slack: ok("slack") };
    await expect(deliver(item(), adapters, "https://g.app")).rejects.toThrow(/alimtalk: .*a.* \/ sms: .*b/);
  });
  it("고객: 연락처가 없으면 실패(재시도 후 dead로 운영자에게 알림)", async () => {
    const adapters: AdapterSet = { alimtalk: ok("alimtalk"), sms: ok("sms"), slack: ok("slack") };
    await expect(deliver(item({ recipient_phone: null }), adapters, "x")).rejects.toThrow("no phone");
  });
  it("운영자: Slack", async () => {
    const adapters: AdapterSet = { alimtalk: ok("alimtalk"), sms: ok("sms"), slack: ok("slack") };
    const r = await deliver(item({ recipient_kind: "admins", template_code: "ADMIN_DEAL_REQUESTED", recipient_phone: null }), adapters, "x");
    expect(r.channel).toBe("slack");
    expect(adapters.alimtalk.send).not.toHaveBeenCalled();
  });
});

describe("runDispatch", () => {
  it("성공은 complete, 실패는 fail로 기록하고 한 건 실패가 다른 건을 막지 않는다", async () => {
    const adapters: AdapterSet = { alimtalk: bad("alimtalk"), sms: bad("sms"), slack: ok("slack") };
    const { store, calls } = memoryStore([
      item({ id: 1 }),
      item({ id: 2, recipient_kind: "admins", template_code: "ADMIN_DEAL_REQUESTED", recipient_phone: null }),
    ]);
    const summary = await runDispatch(store, adapters, { siteUrl: "x" });
    expect(summary).toEqual({ claimed: 2, sent: 1, failed: 1, dead: 0, errors: 0 });
    expect(calls.complete).toEqual([[2, "slack", "slack-id"]]);
    expect(calls.fail[0]?.[0]).toBe(1);
  });
  it("fail이 dead를 돌려주면 dead로 집계", async () => {
    const adapters: AdapterSet = { alimtalk: bad("alimtalk"), sms: bad("sms"), slack: ok("slack") };
    const { store } = memoryStore([item({ attempts: 5 })], "dead");
    expect((await runDispatch(store, adapters, { siteUrl: "x" })).dead).toBe(1);
  });
  it("결과 기록이 실패해도 예외로 중단하지 않는다(lease 만료 후 재claim)", async () => {
    const adapters: AdapterSet = { alimtalk: ok("alimtalk"), sms: ok("sms"), slack: ok("slack") };
    const { store } = memoryStore([item()]);
    store.complete = vi.fn(async () => { throw new Error("db down"); });
    store.fail = vi.fn(async () => { throw new Error("db down"); });
    expect((await runDispatch(store, adapters, { siteUrl: "x" })).errors).toBe(1);
  });
});

describe("adapters", () => {
  it("콘솔 어댑터는 전화번호를 가린다", async () => {
    const lines: string[] = [];
    await new ConsoleAdapter("sms", (l) => lines.push(l)).send({ to: "+821012345678", message: { title: "t", text: "x" }, dedupeKey: "k", templateCode: "T" });
    expect(lines[0]).toContain("010-****-5678");
    expect(lines[0]).not.toContain("12345678");
  });
  it("Slack 웹훅: 2xx 성공, 그 외 DeliveryError", async () => {
    const okFetch = vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
    await expect(new SlackWebhookAdapter("https://hooks.example/x", okFetch).send({ to: null, message: { title: "t", text: "x", url: "https://g/a" }, dedupeKey: "k", templateCode: "T" }))
      .resolves.toEqual({ messageId: "slack:k" });
    const body = JSON.parse((okFetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1].body as string);
    expect(body.text).toContain("<https://g/a|열기>");
    const badFetch = vi.fn(async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(new SlackWebhookAdapter("https://hooks.example/x", badFetch).send({ to: null, message: { title: "t", text: "x" }, dedupeKey: "k", templateCode: "T" }))
      .rejects.toThrow("slack webhook 404");
  });
  it("웹훅이 없으면 Slack도 콘솔, 모르는 대행사 이름은 거부", () => {
    expect(createAdapters({}).slack.name).toBe("console");
    expect(createAdapters({ SLACK_WEBHOOK_URL: "https://hooks.example/x" }).slack.name).toBe("slack-webhook");
    expect(() => createAdapters({ NOTIFY_CUSTOMER_PROVIDER: "solapi" })).toThrow("unknown");
  });
});

// 부킹 DB 제거(D-88)로 더 이상 쌓이지 않는 템플릿. 예전 마이그레이션(004)은 고치지 않으므로 SQL에는 남아 있다
const RETIRED_TEMPLATES = [
  "BOOKING_IN_REVIEW", "BOOKING_PROPOSED", "BOOKING_CONFIRMED", "BOOKING_REJECTED", "BOOKING_CANCELLED",
  "BOOKING_PROPOSAL_EXPIRED", "ADMIN_BOOKING_REQUESTED", "ADMIN_BOOKING_CONFIRMED", "ADMIN_BOOKING_CANCELLED",
  "ADMIN_PROPOSAL_DECLINED", "ADMIN_PROPOSAL_EXPIRED", "ADMIN_SLA_BREACHED",
];

describe("templates", () => {
  it("DB가 쌓는 모든 템플릿 코드를 렌더할 수 있다(제거된 부킹 템플릿 제외)", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const sql = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
    const codes = new Set([...sql.matchAll(/'((?:ADMIN_|BOOKING_|DEAL_|GROUP_)[A-Z_]+)'/g)].map((m) => m[1]!));
    for (const code of codes) if (!RETIRED_TEMPLATES.includes(code)) expect(KNOWN_TEMPLATES, code).toContain(code);
  });
  it("제거된 부킹 템플릿은 렌더러에 없고, 부킹 제거 마이그레이션이 대기 중인 행을 모두 정리한다", async () => {
    const { readFileSync } = await import("node:fs");
    const drop = readFileSync("supabase/migrations/20261020000017_drop_booking.sql", "utf8");
    for (const code of RETIRED_TEMPLATES) {
      expect(KNOWN_TEMPLATES, code).not.toContain(code);
      expect(drop, code).toContain(`'${code}'`);
    }
  });
  it("모르는 템플릿(예전 부킹 dead 행 재시도 등)은 실패하지 않고 기본 문구로 보낸다", () => {
    expect(renderMessage({ template_code: "BOOKING_PROPOSED", payload: { request_id: "r1" } }, "https://g.app/"))
      .toEqual({ title: "Googolf 알림", text: "BOOKING_PROPOSED", url: "https://g.app" });
  });
  it("정모 알림: KST 시각·링크", () => {
    const m = renderMessage(item(), "https://g.app/");
    expect(m.text).toContain("11월 정모");
    expect(m.text).toContain("10월 28일");
    expect(m.url).toBe("https://g.app/groups/g1");
  });
  it("거래 알림: 상태 라벨·링크", () => {
    const m = renderMessage({ template_code: "DEAL_STATUS_CHANGED", payload: { deal_id: "d1", product_name: "구골프 레이크CC 정회원", status_label: "가격 협의" } }, "https://g.app");
    expect(m.text).toBe("구골프 레이크CC 정회원 상담이 '가격 협의' 단계입니다.");
    expect(m.url).toBe("https://g.app/deals/d1");
  });
  it("오류 문구에서 전화번호를 지운다", () => {
    expect(sanitizeError(new Error("bad number 010-1234-5678"))).not.toContain("1234");
  });
});

describe("rest-store", () => {
  it("service_role 키로 RPC를 호출하고, 실패는 코드만 담아 던진다", async () => {
    const { createRestStore } = await import("./rest-store.ts");
    const calls: [string, RequestInit][] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (url.endsWith("/fail_notification")) return new Response(JSON.stringify({ code: "GB409", message: "invalid_state" }), { status: 409 });
      if (url.endsWith("/claim_notifications")) return new Response("[]", { status: 200 });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const store = createRestStore("http://db.local/", "svc", fetchImpl);
    await expect(store.claim(5)).resolves.toEqual([]);
    await expect(store.complete(1, "slack", "m")).resolves.toBeUndefined();
    await expect(store.fail(1, "e")).rejects.toThrow("fail_notification failed: GB409");
    expect(calls[0]![0]).toBe("http://db.local/rest/v1/rpc/claim_notifications");
    expect((calls[0]![1].headers as Record<string, string>).Authorization).toBe("Bearer svc");
    expect(JSON.parse(calls[0]![1].body as string)).toEqual({ p_limit: 5 });
  });
});

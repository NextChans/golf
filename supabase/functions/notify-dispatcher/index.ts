// Googolf 알림 발송기(M6, N-01·N-02). pg_cron(app.invoke_notify_dispatcher)이 1분마다 호출한다.
// 인증: config.toml에서 verify_jwt=false로 두고 x-dispatch-secret 헤더를 상수 시간 비교로 확인한다.
// DB 접근은 service_role(Edge 런타임이 SUPABASE_SERVICE_ROLE_KEY를 주입)로 claim/complete/fail RPC만 부른다.
// 외부 패키지를 쓰지 않는다(_shared는 fetch만 사용).
import { createAdapters } from "../_shared/notify/adapters.ts";
import { runDispatch } from "../_shared/notify/dispatch.ts";
import { createRestStore } from "../_shared/notify/rest-store.ts";

const env = (name: string) => Deno.env.get(name) ?? undefined;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const secret = env("NOTIFY_DISPATCH_SECRET");
  // 비밀값 미설정(운영 설정 누락)과 불일치(Vault 값과 다름)를 응답으로 구분한다. net._http_response만 보고 원인을 알 수 있게
  if (!secret) {
    console.error(JSON.stringify({ event: "notify.dispatch.misconfigured", missing: "NOTIFY_DISPATCH_SECRET" }));
    return new Response("dispatch secret not configured", { status: 500 });
  }
  if (!timingSafeEqual(req.headers.get("x-dispatch-secret") ?? "", secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const store = createRestStore(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);
    const adapters = createAdapters({
      SLACK_WEBHOOK_URL: env("SLACK_WEBHOOK_URL"),
      NOTIFY_CUSTOMER_PROVIDER: env("NOTIFY_CUSTOMER_PROVIDER"),
    });
    const summary = await runDispatch(store, adapters, { siteUrl: env("NOTIFY_SITE_URL") ?? "http://localhost:3000" });
    console.log(JSON.stringify({ event: "notify.dispatch", ...summary }));
    return Response.json(summary);
  } catch (err) {
    console.error(JSON.stringify({ event: "notify.dispatch.error", message: err instanceof Error ? err.message : String(err) }));
    return new Response("dispatch error", { status: 500 });
  }
});

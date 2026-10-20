/**
 * 로컬 개발용 발송기 1회 실행: Edge Function과 같은 코드(runDispatch + REST 저장소)를 Node에서 service_role로 돌린다.
 * 사용: pnpm notify:dispatch   (로컬 Supabase 전용. 운영 DB에서 실행하지 않는다)
 */
import nextEnv from "@next/env";
import { createAdapters } from "../../supabase/functions/_shared/notify/adapters.ts";
import { runDispatch } from "../../supabase/functions/_shared/notify/dispatch.ts";
import { createRestStore } from "../../supabase/functions/_shared/notify/rest-store.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("로컬 Supabase에서만 실행합니다.");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 필요합니다(.env.local).");

const summary = await runDispatch(createRestStore(url, key), createAdapters({ SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL }), {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
});
console.log(JSON.stringify(summary));

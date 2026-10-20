/**
 * supabase/migrations/*.sql을 한 파일로 묶어 Supabase 대시보드 SQL Editor에 붙여넣을 수 있게 한다.
 * - 한 트랜잭션으로 실행(중간 실패 시 전체 롤백)
 * - supabase_migrations.schema_migrations에 적용 이력을 남겨, 이후 `supabase db push`(db-deploy)가 중복 적용하지 않게 한다
 * - seed.sql은 포함하지 않는다(로컬 전용 테스트 데이터)
 * 사용: node scripts/bundle-migrations.mjs [--from 20261020000005] > deploy/prod-schema.sql
 */
import { readdirSync, readFileSync } from "node:fs";

const fromIdx = process.argv.indexOf("--from");
const from = fromIdx > -1 ? process.argv[fromIdx + 1] : null;
const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().filter((f) => !from || f >= from);

const out = [];
out.push(`-- Googolf 운영 DB 스키마 일괄 적용 (자동 생성: node scripts/bundle-migrations.mjs${from ? ` --from ${from}` : ""})`);
out.push(`-- 포함 마이그레이션: ${files.join(", ")}`);
out.push("-- Supabase 대시보드 → SQL Editor → 새 쿼리에 전체를 붙여넣고 Run. 이미 적용된 버전은 다시 실행하지 말 것.");
out.push("begin;", "");
out.push("create schema if not exists supabase_migrations;");
out.push("create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);");
out.push("-- 이미 적용된 마이그레이션이 하나라도 있으면 중단(이중 적용 방지)");
out.push(`do $$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version in (${files.map((f) => `'${f.split("_")[0]}'`).join(", ")})) then
    raise exception '이미 적용된 마이그레이션이 있습니다. supabase_migrations.schema_migrations를 확인하세요.';
  end if;
end $$;`, "");
for (const f of files) {
  const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
  out.push(`-- ════════ ${f} ════════`);
  out.push(readFileSync(`${dir}/${f}`, "utf8").trimEnd(), "");
  out.push(`insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${rest.join("_")}');`, "");
}
out.push("commit;");
process.stdout.write(out.join("\n") + "\n");

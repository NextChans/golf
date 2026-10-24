-- Googolf 운영 DB 스키마 일괄 적용 (자동 생성: node scripts/bundle-migrations.mjs --from 20261020000016)
-- 포함 마이그레이션: 20261020000016_quotes_source_grant.sql
-- Supabase 대시보드 → SQL Editor → 새 쿼리에 전체를 붙여넣고 Run. 이미 적용된 버전은 다시 실행하지 말 것.
begin;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
-- 이미 적용된 마이그레이션이 하나라도 있으면 중단(이중 적용 방지)
do $$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version in ('20261020000016')) then
    raise exception '이미 적용된 마이그레이션이 있습니다. supabase_migrations.schema_migrations를 확인하세요.';
  end if;
end $$;

-- ════════ 20261020000016_quotes_source_grant.sql ════════
-- 015에서 추가한 membership_quotes.source 컬럼의 조회 권한(이 테이블은 컬럼 단위로 공개한다: created_by 비공개)
-- 015 적용 후 화면이 source를 읽으면 42501이 난다. 앱(시세 출처 표시) 배포 전에 적용한다(D-50)
grant select (source) on public.membership_quotes to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000016', 'quotes_source_grant');

commit;

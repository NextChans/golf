-- Googolf 운영 DB 스키마 일괄 적용 (자동 생성: node scripts/bundle-migrations.mjs --from 20261020000012)
-- 포함 마이그레이션: 20261020000012_deal_status_label.sql
-- Supabase 대시보드 → SQL Editor → 새 쿼리에 전체를 붙여넣고 Run. 이미 적용된 버전은 다시 실행하지 말 것.
begin;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
-- 이미 적용된 마이그레이션이 하나라도 있으면 중단(이중 적용 방지)
do $$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version in ('20261020000012')) then
    raise exception '이미 적용된 마이그레이션이 있습니다. supabase_migrations.schema_migrations를 확인하세요.';
  end if;
end $$;

-- ════════ 20261020000012_deal_status_label.sql ════════
-- Googolf M5: 거래 상태 라벨을 화면(lib/domain/membership/status.ts DEAL_STATUS_LABEL)과 통일한다(D-61).
-- 타임라인 문구·알림 payload의 status_label이 배지와 같은 말을 쓰게 한다. 이미 저장된 deal_events 문구는 그대로 둔다.
create or replace function app.deal_status_label(p_status public.deal_status) returns text
language sql immutable
set search_path = ''
as $$
  select case p_status
    when 'inquiry' then '상담 접수'
    when 'negotiating' then '협의 중'
    when 'contract_scheduled' then '계약 예정'
    when 'contracted' then '계약 완료'
    when 'transferring' then '명의 이전 중'
    when 'completed' then '거래 완료'
    when 'cancelled' then '취소됨'
  end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020000012', 'deal_status_label');

commit;

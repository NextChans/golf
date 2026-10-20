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

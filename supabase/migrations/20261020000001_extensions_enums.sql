-- Googolf M1: 확장, 내부 스키마, enum 타입
-- 상태 머신 정의는 docs/state-machine.md 참고. enum 값을 바꾸면 문서와 lib/domain 상수도 함께 바꾼다.

create extension if not exists pg_cron;
create extension if not exists pgcrypto with schema extensions;

-- 내부 헬퍼 전용 스키마. PostgREST에 노출하지 않는다(config.toml api.schemas에 넣지 않음).
create schema if not exists app;
revoke all on schema app from public;

create type public.region as enum (
  'seoul_gyeonggi', 'gangwon', 'chungcheong', 'jeolla', 'gyeongsang', 'jeju'
);

create type public.time_pref as enum ('part_1', 'part_2', 'range');

create type public.booking_status as enum (
  'requested', 'in_review', 'proposed', 'confirmed', 'rejected', 'cancelled'
);

create type public.proposal_status as enum (
  'offered', 'accepted', 'declined', 'expired', 'withdrawn'
);

create type public.listing_status as enum ('listed', 'reserved', 'sold', 'hidden');

create type public.deal_side as enum ('buy', 'sell');

create type public.deal_status as enum (
  'inquiry', 'negotiating', 'contract_scheduled', 'contracted', 'transferring', 'completed', 'cancelled'
);

create type public.notify_channel as enum ('alimtalk', 'sms', 'slack', 'email');

create type public.outbox_status as enum ('pending', 'sending', 'sent', 'failed', 'dead');

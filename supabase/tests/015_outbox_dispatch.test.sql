-- M6: 알림 발송 claim·성공·실패 백오프·dead·lease 만료·권한
begin;
select plan(23);
-- service_role로 전환한 뒤에도 테스트 헬퍼로 돌아올 수 있게(트랜잭션 안에서만, rollback으로 원복)
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;

select tests.create_user('cust@test.local') as cust \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

-- 테스트가 만든 알림만 다루도록 기존 대기 행을 미래로 미룬다(로컬에 남은 데이터와 무관하게)
update public.notification_outbox set next_attempt_at = now() + interval '1 day' where status in ('pending', 'failed');
update public.notification_outbox set locked_at = now() where status = 'sending'; -- lease 만료된 잔여 행도 잡히지 않게

select tests.authenticate_as(:'cust', 'aal1');
select id as req from tests.new_booking() \gset
select tests.clear_authentication();
select id as admin_note from public.notification_outbox where dedupe_key = 'booking:' || :'req' || ':requested' \gset
select is((select template_code from public.notification_outbox where id = :admin_note), 'ADMIN_BOOKING_REQUESTED', '신규 요청 시 운영자 알림 적재');

-- 권한: 고객·운영자 세션은 claim 불가, service_role만
select tests.authenticate_as(:'admin');
select throws_ok('select * from public.claim_notifications(10)', '42501', null, '운영자 세션은 claim 불가');
select tests.clear_authentication();

create function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('role', 'service_role', true);
$$;

select pg_temp.as_service();
select is((select count(*)::int from public.claim_notifications(10) c where c.id = :admin_note), 1, 'claim이 대기 알림을 잡는다');
select is((select count(*)::int from public.claim_notifications(10) c where c.id = :admin_note), 0, '잡힌 알림은 다시 잡히지 않는다(중복 발송 없음)');
select tests.clear_authentication();
select is((select status::text || '/' || attempts from public.notification_outbox where id = :admin_note), 'sending/1', 'sending, 시도 1');

-- 실패 → 백오프 1분
select pg_temp.as_service();
select is(public.fail_notification(:admin_note, 'webhook 500')::text, 'failed', '1회 실패 → failed');
select tests.clear_authentication();
select ok((select next_attempt_at between now() + interval '55 seconds' and now() + interval '65 seconds'
            from public.notification_outbox where id = :admin_note), '첫 재시도는 1분 뒤');
select pg_temp.as_service();
select is((select count(*)::int from public.claim_notifications(10) c where c.id = :admin_note), 0, '백오프 중에는 claim 안 됨');

-- 2~4회 실패: 매번 시각을 당겨 재시도, 백오프가 2배씩
select tests.clear_authentication();
update public.notification_outbox set next_attempt_at = now() where id = :admin_note;
select pg_temp.as_service();
select public.claim_notifications(10);
select public.fail_notification(:admin_note, 'e2');
select tests.clear_authentication();
select ok((select next_attempt_at between now() + interval '115 seconds' and now() + interval '125 seconds'
            from public.notification_outbox where id = :admin_note), '두 번째 재시도는 2분 뒤');
update public.notification_outbox set next_attempt_at = now() where id = :admin_note;
select pg_temp.as_service();
select public.claim_notifications(10);
select public.fail_notification(:admin_note, 'e3');
select tests.clear_authentication();
update public.notification_outbox set next_attempt_at = now() where id = :admin_note;
select pg_temp.as_service();
select public.claim_notifications(10);
select public.fail_notification(:admin_note, 'e4');
select tests.clear_authentication();
update public.notification_outbox set next_attempt_at = now() where id = :admin_note;

-- 5회째 실패 → dead + 운영자 알림(같은 트랜잭션)
select pg_temp.as_service();
select public.claim_notifications(10);
select is(public.fail_notification(:admin_note, 'final error')::text, 'dead', '5회째 실패 → dead');
select tests.clear_authentication();
select is((select attempts from public.notification_outbox where id = :admin_note), 5, '시도 5회');
select id as dead_alert from public.notification_outbox where dedupe_key = 'outbox:' || :admin_note || ':dead' \gset
select is((select template_code from public.notification_outbox where id = :dead_alert), 'ADMIN_NOTIFICATION_DEAD', 'dead 시 운영자 알림 적재');
select is((select payload ->> 'last_error' from public.notification_outbox where id = :dead_alert), 'final error', '마지막 오류 포함');
select pg_temp.as_service();
select throws_ok(format('select public.fail_notification(%s, %L)', :admin_note, 'x'), 'GB409', 'invalid_state', 'dead 행은 다시 실패 기록 불가');

-- 운영자 알림 자체가 dead가 되면 연쇄 알림을 만들지 않는다
select tests.clear_authentication();
update public.notification_outbox set attempts = 4, next_attempt_at = now() where id = :dead_alert;
select pg_temp.as_service();
select public.claim_notifications(10);
select public.fail_notification(:dead_alert, 'slack down');
select tests.clear_authentication();
select is((select count(*)::int from public.notification_outbox where dedupe_key = 'outbox:' || :dead_alert || ':dead'), 0, 'dead 알림의 dead는 다시 알리지 않음');

-- lease 만료: sending에 5분 넘게 남은 행은 다시 잡힌다
select tests.authenticate_as(:'cust', 'aal1');
select id as req2 from tests.new_booking() \gset
select tests.clear_authentication();
select id as n2 from public.notification_outbox where dedupe_key = 'booking:' || :'req2' || ':requested' \gset
select pg_temp.as_service();
select public.claim_notifications(10);
select tests.clear_authentication();
update public.notification_outbox set locked_at = now() - interval '6 minutes' where id = :n2;
select pg_temp.as_service();
select is((select attempts from public.claim_notifications(10) c where c.id = :n2), 2, 'lease 만료 행은 다시 claim(시도 2)');
select lives_ok(format($q$select public.complete_notification(%s, 'slack', 'msg-1')$q$, :n2), '성공 기록');
select throws_ok(format($q$select public.complete_notification(%s, 'slack', 'msg-1')$q$, :n2), 'GB409', 'invalid_state', '이미 보낸 행은 다시 성공 처리 안 함');
select tests.clear_authentication();
select is((select status::text from public.notification_outbox where id = :n2), 'sent', 'sent');

-- 운영자 재시도: dead → pending, 감사 로그
select tests.authenticate_as(:'admin');
select is((public.retry_notification(:admin_note)).status::text, 'pending', 'dead 알림 재시도');
select tests.clear_authentication();
select is((select count(*)::int from public.audit_logs where entity_type = 'notification' and entity_id = :admin_note::text and action = 'retry'), 1, '재시도 감사 로그');

select is((select count(*)::int from cron.job where jobname = 'notify-dispatch'), 1, '발송 cron 잡 등록');
select is(app.invoke_notify_dispatcher(), null, 'Vault 비밀값이 없으면 발송기를 호출하지 않는다');

select * from finish();
rollback;

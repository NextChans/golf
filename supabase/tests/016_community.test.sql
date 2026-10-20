-- M7: 골프 모임 — 개설·금칙어 보류·가입/승인·정원·역할·승계·강퇴·정모·게시판·신고·RLS
begin;
select plan(43);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('b@test.local') as b \gset
select tests.create_user('c@test.local') as c \gset
select tests.create_user('d@test.local') as d \gset
select tests.create_user('outsider@test.local') as outsider \gset
select tests.create_user('admin@test.local', 'admin') as admin \gset

-- ── 개설 ──
select tests.authenticate_as(:'owner', 'aal1');
select (public.create_group(gen_random_uuid(), '  주말 라운딩 모임  ', 'round', 'seoul_gyeonggi',
  '주말 아침 경기권 필드 라운딩을 함께합니다.', 'approval', 3, null)).id as g \gset
select is((select status::text from public.groups where id = :'g'), 'active', '일반 모임은 바로 공개');
select is((select name from public.groups where id = :'g'), '주말 라운딩 모임', '이름 공백 제거');
select is((select role::text || '/' || status from public.group_members where group_id = :'g' and user_id = :'owner'), 'owner/active', '만든 사람은 모임장');
select (public.create_group(gen_random_uuid(), '골프 소개팅 모임', 'round', 'jeju', '골프 치고 소개팅도 하는 모임입니다.', 'open', 50, null)).id as flagged \gset
select is((select status::text from public.groups where id = :'flagged'), 'review', '금칙어가 있으면 검수 대기');
select tests.clear_authentication();
select ok(exists(select 1 from public.notification_outbox where dedupe_key = 'group:' || :'flagged' || ':review'), '검수 대기 시 운영자 알림');
select tests.authenticate_as(:'owner', 'aal1');
select throws_ok($q$select public.create_group(gen_random_uuid(), '링크', 'screen', 'jeju', '스크린 모임입니다 열 글자', 'open', 10, 'https://evil.example/x')$q$,
  'GB422', 'invalid_input', '오픈채팅 링크는 카카오 오픈채팅만');
select (public.create_group(gen_random_uuid(), '세 번째', 'screen', 'jeju', '스크린골프 정기 모임입니다.', 'open', 10, null)).id as g3 \gset
select throws_ok($q$select public.create_group(gen_random_uuid(), '네 번째', 'screen', 'jeju', '스크린골프 정기 모임입니다.', 'open', 10, null)$q$,
  'GB422', 'limit_exceeded', '모임장은 모임 3개까지');

-- 운영자는 고객 함수를 쓸 수 없다
select tests.authenticate_as(:'admin');
select throws_ok(format('select public.join_group(%L, null)', :'g'), 'GB403', 'forbidden', '운영자는 모임 가입 불가');

-- ── 공개 목록(RLS) ──
select tests.authenticate_anon();
select is((select count(*)::int from public.groups where id in (:'g', :'flagged')), 1, '비로그인은 공개 모임만 본다(검수 대기 제외)');

-- ── 승인제 가입 ──
select tests.authenticate_as(:'b', 'aal1');
select is((public.join_group(:'g', ' 안녕하세요 ')).status::text, 'pending', '승인제는 대기');
select is((select count(*)::int from public.group_posts where group_id = :'g'), 0, '대기 중에는 게시판을 못 본다');
select throws_ok(format('select public.decide_join(%L, %L, true)', :'g', :'b'), 'GB403', 'forbidden', '멤버가 아니면 승인 불가');
select tests.authenticate_as(:'owner', 'aal1');
select is((public.decide_join(:'g', :'b', true)).status::text, 'active', '모임장이 승인');
select is((select member_count from public.groups where id = :'g'), 2, '멤버 수 증가');
select tests.clear_authentication();
select ok(exists(select 1 from public.notification_outbox where template_code = 'GROUP_JOIN_APPROVED' and recipient_user_id = :'b'), '가입 승인 알림');
select tests.authenticate_as(:'c', 'aal1');
select public.join_group(:'g', null);
select tests.authenticate_as(:'owner', 'aal1');
select public.decide_join(:'g', :'c', true);
select tests.authenticate_as(:'d', 'aal1');
select public.join_group(:'g', null);
select tests.authenticate_as(:'owner', 'aal1');
select throws_ok(format('select public.decide_join(%L, %L, true)', :'g', :'d'), 'GB409', 'group_full', '정원(3명) 초과 승인 불가');
select is(public.decide_join(:'g', :'d', false), null, '거절하면 신청 삭제');
select is((select count(*)::int from public.group_members where group_id = :'g' and user_id = :'d'), 0, '거절된 신청은 남지 않음');

-- ── 멤버 RLS: 같은 모임 멤버만 회원 목록을 본다, 연락처 컬럼 없음 ──
select tests.authenticate_as(:'outsider', 'aal1');
select is((select count(*)::int from public.group_members where group_id = :'g'), 0, '비멤버는 회원 목록 불가');
select tests.authenticate_as(:'b', 'aal1');
select is((select count(*)::int from public.group_members where group_id = :'g'), 3, '멤버는 회원 목록 조회');

-- ── 정모 ──
select throws_ok(format($q$select public.create_meeting(%L, '라운딩', now() + interval '3 days', %L, null, 2, 150000, null)$q$, :'g', '00000000-0000-4000-a000-000000000001'),
  'GB403', 'forbidden', '일반 멤버는 정모 개설 불가');
select tests.authenticate_as(:'owner', 'aal1');
select (public.create_meeting(:'g', '11월 첫 라운딩', now() + interval '3 days', '00000000-0000-4000-a000-000000000001', null, 2, 150000, '카트 포함')).id as m \gset
select is((select attendee_count from public.group_meetings where id = :'m'), 1, '개설자는 자동 참석');
select tests.clear_authentication();
select is((select count(*)::int from public.notification_outbox where template_code = 'GROUP_MEETING_CREATED' and payload ->> 'meeting_id' = :'m'), 2, '다른 멤버 2명에게 정모 알림');
select tests.authenticate_as(:'owner', 'aal1');
select throws_ok(format($q$select public.create_meeting(%L, '과거', now() - interval '1 hour', null, '스크린', 4, null, null)$q$, :'g'),
  'GB422', 'invalid_input', '지난 시각 정모 불가');
select tests.authenticate_as(:'b', 'aal1');
select is((public.attend_meeting(:'m')).attendee_count, 2, '참석');
select is((public.attend_meeting(:'m')).attendee_count, 2, '중복 참석은 멱등');
select tests.authenticate_as(:'c', 'aal1');
select throws_ok(format('select public.attend_meeting(%L)', :'m'), 'GB409', 'meeting_full', '정원 마감');
select tests.authenticate_as(:'outsider', 'aal1');
select throws_ok(format('select public.attend_meeting(%L)', :'m'), 'GB404', 'not_found', '비멤버는 참석 불가');
select tests.authenticate_as(:'b', 'aal1');
select is((public.cancel_attendance(:'m')).attendee_count, 1, '참석 취소');

-- ── 게시판 ──
select throws_ok(format($q$select public.create_post(%L, '공지', '본문', true)$q$, :'g'), 'GB403', 'forbidden', '멤버는 공지 불가');
select (public.create_post(:'g', '안녕하세요', '반갑습니다', false)).id as post \gset
select tests.authenticate_as(:'owner', 'aal1');
select is((public.create_post(:'g', '모임 규칙', '매너 라운딩', true)).is_pinned, true, '공지는 자동 고정');

-- ── 신고: 3건 누적 시 게시글 자동 비노출 ──
select tests.authenticate_as(:'owner', 'aal1');
select public.report_content('post', :'post', 'spam', null);
select tests.authenticate_as(:'c', 'aal1');
select public.report_content('post', :'post', 'spam', '도배');
select throws_ok(format($q$select public.report_content('post', %L, 'spam', null)$q$, :'post'), 'GB409', 'duplicate_report', '같은 대상 중복 신고 불가');
select tests.authenticate_as(:'outsider', 'aal1');
select throws_ok(format($q$select public.report_content('post', %L, 'spam', null)$q$, :'post'), 'GB404', 'not_found', '비멤버는 게시글 신고 불가');
select public.report_content('group', :'g', 'not_golf', null);
-- 세 번째 게시글 신고자(멤버): 탈퇴한 사람 대신 새 멤버를 만든다
select tests.create_user('e@test.local') as e \gset
select tests.clear_authentication();
update public.groups set capacity = 4 where id = :'g'; -- 픽스처: 정원 확대(운영에서는 update_group)
select tests.authenticate_as(:'e', 'aal1');
select public.join_group(:'g', null);
select tests.authenticate_as(:'owner', 'aal1');
select public.decide_join(:'g', :'e', true);
select tests.authenticate_as(:'e', 'aal1');
select public.report_content('post', :'post', 'abuse', null);
select tests.clear_authentication();
select is((select status from public.group_posts where id = :'post'), 'hidden', '열린 신고 3건이면 게시글 자동 비노출');

-- ── 강퇴: 재가입 불가, 운영진은 운영진을 강퇴할 수 없음 ──
select tests.authenticate_as(:'owner', 'aal1');
select public.set_member_role(:'g', :'b', 'manager');
select tests.authenticate_as(:'b', 'aal1');
select public.kick_member(:'g', :'c');
select tests.authenticate_as(:'c', 'aal1');
select throws_ok(format('select public.join_group(%L, null)', :'g'), 'GB403', 'forbidden', '강퇴된 회원은 재가입 불가');
select tests.authenticate_as(:'owner', 'aal1');
select public.set_member_role(:'g', :'e', 'manager');
select tests.authenticate_as(:'b', 'aal1');
select throws_ok(format('select public.kick_member(%L, %L)', :'g', :'e'), 'GB403', 'forbidden', '운영진은 운영진 강퇴 불가');

-- ── 모임장 탈퇴 → 가장 먼저 가입한 운영진이 승계 ──
select tests.authenticate_as(:'owner', 'aal1');
select public.leave_group(:'g');
select tests.clear_authentication();
select is((select owner_id from public.groups where id = :'g'), :'b'::uuid, '모임장 탈퇴 시 운영진이 승계');
select is((select count(*)::int from public.group_members where group_id = :'g' and role = 'owner'), 1, '모임장은 항상 1명');

-- ── 운영자 검수 ──
select tests.authenticate_as(:'admin');
select is((public.moderate_group(:'flagged', 'active', '골프 모임 확인')).status::text, 'active', '운영자가 검수 통과');
select public.moderate_group(:'g3', 'hidden', '정책 위반');
select tests.clear_authentication();
select ok(exists(select 1 from public.notification_outbox where template_code = 'GROUP_HIDDEN' and recipient_user_id = :'owner'), '비공개 처리 시 모임장 알림');
select tests.authenticate_as(:'b', 'aal1');
select throws_ok(format('select public.moderate_group(%L, %L, null)', :'g', 'hidden'), 'GB403', 'forbidden', '고객은 운영자 검수 불가');

-- ── 직접 DML 차단 ──
select throws_ok(format($q$update public.groups set status = 'active' where id = %L$q$, :'g3'), '42501', null, '상태 직접 변경 불가');
select tests.clear_authentication();
select ok((select count(*) from public.audit_logs where entity_type in ('group', 'group_member', 'group_meeting', 'group_post', 'community_report')) >= 15,
  '커뮤니티 변경이 감사 로그에 기록');

select * from finish();
rollback;

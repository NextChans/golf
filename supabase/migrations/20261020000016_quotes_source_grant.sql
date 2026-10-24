-- 015에서 추가한 membership_quotes.source 컬럼의 조회 권한(이 테이블은 컬럼 단위로 공개한다: created_by 비공개)
-- 015 적용 후 화면이 source를 읽으면 42501이 난다. 앱(시세 출처 표시) 배포 전에 적용한다(D-50)
grant select (source) on public.membership_quotes to anon, authenticated;

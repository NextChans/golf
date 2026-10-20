-- Googolf M4: 운영자 업무 함수 — 골프장 마스터(A-03), 통화 메모(A-06), 배정 대상 운영자 목록(A-01)

-- ── 골프장 저장(생성·수정) ─────────────────────────────────
create or replace function public.upsert_golf_course(
  p_id uuid,
  p_name text,
  p_region public.region,
  p_address text,
  p_weekday_green_fee bigint,
  p_weekend_green_fee bigint,
  p_cancellation_policy text,
  p_contact_phone text,
  p_is_active boolean
) returns public.golf_courses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.golf_courses;
  v_after public.golf_courses;
begin
  perform app.require_admin();
  p_name := nullif(trim(p_name), '');
  if p_name is null then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'name required';
  end if;

  begin
    if p_id is null then
      insert into public.golf_courses (name, region, address, weekday_green_fee, weekend_green_fee,
                                       cancellation_policy, contact_phone, is_active)
      values (p_name, p_region, nullif(trim(p_address), ''), p_weekday_green_fee, p_weekend_green_fee,
              nullif(trim(p_cancellation_policy), ''), nullif(trim(p_contact_phone), ''), coalesce(p_is_active, true))
      returning * into v_after;
    else
      select * into v_before from public.golf_courses where id = p_id for update;
      if not found then
        raise exception 'not_found' using errcode = 'GB404';
      end if;
      update public.golf_courses set
        name = p_name, region = p_region, address = nullif(trim(p_address), ''),
        weekday_green_fee = p_weekday_green_fee, weekend_green_fee = p_weekend_green_fee,
        cancellation_policy = nullif(trim(p_cancellation_policy), ''),
        contact_phone = nullif(trim(p_contact_phone), ''), is_active = coalesce(p_is_active, is_active)
      where id = p_id returning * into v_after;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate_name' using errcode = 'GB409', detail = '같은 이름의 골프장이 있습니다';
    when check_violation then
      raise exception 'invalid_input' using errcode = 'GB422', detail = sqlerrm;
  end;

  perform app.write_audit('golf_course', v_after.id::text, case when p_id is null then 'create' else 'update' end,
    to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

-- ── 통화 메모(append-only, D-19) ──────────────────────────
-- subject가 booking/deal이면 그 건이 해당 고객의 것인지 확인한다.
create or replace function public.add_activity_note(
  p_customer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_body text
) returns public.activity_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_admin();
  v_note public.activity_notes;
begin
  p_body := nullif(trim(p_body), '');
  if p_body is null or char_length(p_body) > 2000 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'body 1..2000';
  end if;
  perform 1 from public.profiles where id = p_customer_id;
  if not found then
    raise exception 'not_found' using errcode = 'GB404', detail = 'customer';
  end if;

  if p_subject_type = 'customer' then
    p_subject_id := null;
  elsif p_subject_type = 'booking' then
    perform 1 from public.booking_requests where id = p_subject_id and user_id = p_customer_id;
    if not found then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'booking does not belong to customer';
    end if;
  elsif p_subject_type = 'deal' then
    perform 1 from public.membership_deals where id = p_subject_id and user_id = p_customer_id;
    if not found then
      raise exception 'invalid_input' using errcode = 'GB422', detail = 'deal does not belong to customer';
    end if;
  else
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'unknown subject_type';
  end if;

  insert into public.activity_notes (customer_id, subject_type, subject_id, body, author_id)
  values (p_customer_id, p_subject_type, p_subject_id, p_body, v_uid)
  returning * into v_note;

  perform app.write_audit('activity_note', v_note.id::text, 'create', null, to_jsonb(v_note));
  return v_note;
end;
$$;

-- ── 배정 대상 운영자 목록(운영자 누구나) ─────────────────────
create or replace function public.list_assignable_staff()
returns table (id uuid, display_name text, email text, is_me boolean)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform app.require_admin();
  return query
    select u.id, coalesce(p.display_name, split_part(u.email, '@', 1))::text, u.email::text, u.id = auth.uid()
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.raw_app_meta_data ->> 'role' in ('admin', 'owner')
       and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email')
     order by (u.id = auth.uid()) desc, 2;
end;
$$;

-- 운영자 화면 목록 조회용 인덱스
create index if not exists profiles_phone_idx on public.profiles (phone);

revoke execute on function
  public.upsert_golf_course(uuid, text, public.region, text, bigint, bigint, text, text, boolean),
  public.add_activity_note(uuid, text, uuid, text),
  public.list_assignable_staff()
from public, anon, service_role;
grant execute on function
  public.upsert_golf_course(uuid, text, public.region, text, bigint, bigint, text, text, boolean),
  public.add_activity_note(uuid, text, uuid, text),
  public.list_assignable_staff()
to authenticated;

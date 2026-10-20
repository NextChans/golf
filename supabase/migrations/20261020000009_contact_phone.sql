-- Googolf: 고객 연락처(휴대폰 번호) 직접 입력 (D-48)
-- 휴대폰 OTP를 끈 동안(D-42) 운영자가 확인 전화를 할 수 있도록 연락처를 입력받는다.
-- 직접 입력한 번호는 미인증(phone_verified_at = null)으로 저장한다.

create or replace function app.normalize_kr_mobile(p_phone text) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[\s-]', '', 'g');
begin
  if v ~ '^\+8210\d{8}$' or v ~ '^\+821[16789]\d{7,8}$' then
    return v;
  end if;
  if v ~ '^010\d{8}$' or v ~ '^01[16789]\d{7,8}$' then
    return '+82' || substr(v, 2);
  end if;
  return null;
end;
$$;

-- 온보딩: 인증 필수 모드면 인증 번호, 아니면 직접 입력한 연락처(필수)
drop function if exists public.complete_onboarding(text, text[]);
create or replace function public.complete_onboarding(
  p_display_name text,
  p_agreed_codes text[],
  p_contact_phone text default null
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
  v_user auth.users;
  v_verification_required boolean := app.setting_bool('phone_verification_required', true);
  v_phone_ok boolean;
  v_phone text;
  v_phone_verified_at timestamptz;
  v_missing text;
  v_before public.profiles;
  v_after public.profiles;
begin
  if app.jwt_role() <> 'customer' then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'staff accounts do not onboard';
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'kakao') then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'kakao account required';
  end if;

  v_phone_ok := coalesce(v_user.phone, '') <> '' and v_user.phone_confirmed_at is not null;
  if v_verification_required then
    if not v_phone_ok then
      raise exception 'phone_not_verified' using errcode = 'GB422';
    end if;
    v_phone := '+' || ltrim(v_user.phone, '+');
    v_phone_verified_at := v_user.phone_confirmed_at;
  else
    v_phone := app.normalize_kr_mobile(p_contact_phone);
    if v_phone is null then
      raise exception 'contact_required' using errcode = 'GB422', detail = 'valid korean mobile number required';
    end if;
    v_phone_verified_at := null;
  end if;

  p_display_name := nullif(trim(p_display_name), '');
  if p_display_name is null or char_length(p_display_name) > 50 then
    raise exception 'invalid_input' using errcode = 'GB422', detail = 'display_name 1..50';
  end if;

  select string_agg(code, ',') into v_missing
    from public.current_terms
   where required and not (code = any (coalesce(p_agreed_codes, '{}')));
  if v_missing is not null then
    raise exception 'terms_required' using errcode = 'GB422', detail = v_missing;
  end if;

  select * into v_before from public.profiles where id = v_uid;

  insert into public.profiles (id, display_name, phone, phone_verified_at, onboarded_at)
  values (v_uid, p_display_name, v_phone, v_phone_verified_at, now())
  on conflict (id) do update set
    display_name = excluded.display_name,
    phone = excluded.phone,
    phone_verified_at = excluded.phone_verified_at,
    onboarded_at = coalesce(public.profiles.onboarded_at, excluded.onboarded_at)
  returning * into v_after;

  insert into public.terms_agreements (user_id, terms_code, version)
  select v_uid, code, version from public.current_terms where code = any (p_agreed_codes)
  on conflict (user_id, terms_code, version) do nothing;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('onboarded', true)
   where id = v_uid;

  perform app.write_audit('profile', v_uid::text, 'onboard', to_jsonb(v_before),
    to_jsonb(v_after) || jsonb_build_object('terms', p_agreed_codes));
  return v_after;
end;
$$;

-- 연락처 변경(본인). 인증 필수 모드에서는 인증 절차(phone_change OTP)로만 바꾼다.
create or replace function public.update_contact_phone(p_contact_phone text) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_customer();
  v_phone text := app.normalize_kr_mobile(p_contact_phone);
  v_before public.profiles;
  v_after public.profiles;
begin
  if app.setting_bool('phone_verification_required', true) then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'verified phone change required';
  end if;
  if v_phone is null then
    raise exception 'contact_required' using errcode = 'GB422', detail = 'valid korean mobile number required';
  end if;

  select * into v_before from public.profiles where id = v_uid for update;
  update public.profiles set phone = v_phone, phone_verified_at = null
   where id = v_uid returning * into v_after;

  perform app.write_audit('profile', v_uid::text, 'update_contact',
    jsonb_build_object('phone', v_before.phone), jsonb_build_object('phone', v_after.phone));
  return v_after;
end;
$$;

-- 연락처가 없는 고객은 부킹 요청·회원권 상담을 만들 수 없다(운영자가 연락할 수단이 없음)
create or replace function app.require_contact_on_insert() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and phone is not null) then
    raise exception 'contact_required' using errcode = 'GB422', detail = 'contact phone required before requesting';
  end if;
  return new;
end;
$$;

create trigger booking_requests_require_contact before insert on public.booking_requests
  for each row execute function app.require_contact_on_insert();
create trigger membership_deals_require_contact before insert on public.membership_deals
  for each row execute function app.require_contact_on_insert();

revoke execute on function public.complete_onboarding(text, text[], text), public.update_contact_phone(text)
  from public, anon, service_role;
grant execute on function public.complete_onboarding(text, text[], text), public.update_contact_phone(text)
  to authenticated;

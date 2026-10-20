-- Googolf M3: 운영 설정 플래그
-- D-42: SMS 대행사 계약 전까지 고객 휴대폰 인증을 끈다. 계약 후 phone_verification_required=true로 켠다.

create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
-- 화면 구성에 필요한 공개 설정만 담는다. 비밀값을 넣지 않는다.
grant select on public.app_settings to anon, authenticated;
create policy app_settings_select on public.app_settings for select to anon, authenticated using (true);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function app.set_updated_at();

insert into public.app_settings (key, value, description) values
  ('phone_verification_required', 'false', '고객 온보딩 시 휴대폰 OTP 인증 필수 여부(SMS 대행사 계약 후 true)');

create or replace function app.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = p_key), p_default);
$$;

-- 설정 변경(owner 전용, 감사 로그)
create or replace function public.set_app_setting(p_key text, p_value jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform app.require_admin();
  if not app.is_owner() then
    raise exception 'forbidden' using errcode = 'GB403', detail = 'owner only';
  end if;
  select value into v_before from public.app_settings where key = p_key for update;
  if not found then
    raise exception 'not_found' using errcode = 'GB404';
  end if;
  update public.app_settings set value = p_value where key = p_key;
  perform app.write_audit('app_setting', p_key, 'update',
    jsonb_build_object('value', v_before), jsonb_build_object('value', p_value));
end;
$$;
revoke execute on function public.set_app_setting(text, jsonb) from public, anon, service_role;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;

-- 온보딩: 휴대폰 인증은 설정에 따라 필수/생략. 인증된 번호가 있으면 저장한다.
create or replace function public.complete_onboarding(
  p_display_name text,
  p_agreed_codes text[]
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_user();
  v_user auth.users;
  v_phone_ok boolean;
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
  if app.setting_bool('phone_verification_required', true) and not v_phone_ok then
    raise exception 'phone_not_verified' using errcode = 'GB422';
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
  values (
    v_uid, p_display_name,
    case when v_phone_ok then '+' || ltrim(v_user.phone, '+') end,
    case when v_phone_ok then v_user.phone_confirmed_at end,
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    phone_verified_at = coalesce(excluded.phone_verified_at, public.profiles.phone_verified_at),
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

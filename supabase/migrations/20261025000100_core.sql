-- CampusShare core schema: settings, profiles, preferences, notifications, credits ledger.
--
-- Security model, in one paragraph:
--   * Every table has Row Level Security enabled (a safety net at the end of the last migration
--     enables it on anything that was missed).
--   * Anything that must be correct under concurrency or must not be editable from a browser
--     (reservations, credit balances, campaign spend, moderation) goes through SECURITY DEFINER
--     functions. Those functions are the only writers; tables have no INSERT/UPDATE policy for them.
--   * Function privileges are locked down at the end of the last migration (allowlist).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Platform settings (configurable policies; nothing is hardcoded in the app)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value, description) values
  ('credits_enabled',            'true',  'Award promotional credits when a donation is collected and verified.'),
  ('credits_per_kg',             '10',    'Credits per kilogram collected (kg and g units).'),
  ('credits_per_unit',           '5',     'Credits per portion/piece/box/bag/litre collected when no weight is known.'),
  ('daily_credit_cap',           '300',   'Maximum credits a donor can earn per day.'),
  ('same_receiver_daily_limit',  '2',     'Collections by the same donor/receiver pair per day before further rewards are held for review.'),
  ('max_active_reservations',    '5',     'Active reservations one receiver can hold at once.'),
  ('cpc_credits',                '5',     'Credits charged per verified ad click.'),
  ('min_campaign_budget',        '50',    'Smallest campaign budget, in credits.'),
  ('enquiries_per_day',          '10',    'Farmer-market enquiries one buyer can send per day.'),
  ('reports_per_day',            '20',    'Reports one user can file per day.'),
  ('co2e_kg_per_kg_food',        '2.5',   'ESTIMATE: kg CO2e avoided per kg of food rescued. Replace with a figure from a source you trust; shown as an estimate in the app.'),
  ('demo_visible',               'false', 'When true, demo records appear in leaderboards and impact totals.');

create or replace function public.setting_num(k text, d numeric) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::numeric from public.platform_settings where key = k), d)
$$;

create or replace function public.setting_bool(k text, d boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = k), d)
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  display_name text not null default 'CampusShare member' check (char_length(display_name) between 2 and 40),
  phone text check (phone is null or char_length(phone) <= 25),
  organisation_name text check (organisation_name is null or char_length(organisation_name) <= 80),
  county text,
  town text,
  primary_role text not null default 'donor' check (primary_role in ('donor', 'receiver')),
  is_farmer boolean not null default false,
  is_advertiser boolean not null default false,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  show_on_leaderboard boolean not null default true,
  avatar_path text,
  onboarding_done boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin and p.status = 'active' from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = auth.uid()), false)
$$;

-- Browser-side roles may not touch protected columns. Definer functions and the service role can.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.is_admin is distinct from old.is_admin
       or new.status is distinct from old.status
       or new.is_demo is distinct from old.is_demo then
      raise exception 'protected_field' using hint = 'is_admin, status and is_demo cannot be changed from the app';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Public, non-sensitive view of a member. No phone, no email, no ids beyond the member id.
create view public.public_profiles as
  select id, display_name, organisation_name, county, town, is_farmer, avatar_path
  from public.profiles
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dietary text[] not null default '{}',
  preferred_categories text[] not null default '{}',
  radius_km integer not null default 10 check (radius_km between 1 and 200),
  county text,
  town text,
  lat numeric(6, 2),
  lng numeric(6, 2),
  ai_personalisation boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  muted_types text[] not null default '{}',
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications (created by server functions only; users can read and mark read)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);
create index notifications_user_unread on public.notifications (user_id) where read_at is null;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  if p_type not like 'security%' and exists (
    select 1 from public.notification_preferences np where np.user_id = p_user and p_type = any (np.muted_types)
  ) then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, p_type, left(p_title, 140), left(coalesce(p_body, ''), 500), p_link);
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and id = any (p_ids) and read_at is null
$$;

create or replace function public.mark_all_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Promotional credits: an append-only ledger plus a cached balance.
-- Nothing here is writable from the browser. All writes go through post_credit().
-- ---------------------------------------------------------------------------
create table public.credit_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0,
  total_spent integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  entry_type text not null check (entry_type in ('earn', 'spend', 'refund', 'adjustment')),
  status text not null default 'posted' check (status in ('posted', 'held', 'reversed')),
  source_type text,
  source_id uuid,
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint credit_sign check (
    (entry_type in ('earn', 'refund') and amount > 0)
    or (entry_type = 'spend' and amount < 0)
    or entry_type = 'adjustment'
  )
);
create index credit_ledger_user_created on public.credit_ledger (user_id, created_at desc);
-- The same event can never award or spend twice.
create unique index credit_ledger_idempotent on public.credit_ledger (entry_type, source_type, source_id)
  where source_id is not null;

create or replace function public.post_credit(
  p_user uuid, p_amount integer, p_type text, p_source_type text, p_source_id uuid, p_status text, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  lid uuid;
  bal integer;
begin
  insert into public.credit_accounts (user_id) values (p_user) on conflict do nothing;
  select balance into bal from public.credit_accounts where user_id = p_user for update;

  if p_status = 'posted' and p_amount < 0 and bal < -p_amount then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (user_id, amount, entry_type, status, source_type, source_id, note)
  values (p_user, p_amount, p_type, p_status, p_source_type, p_source_id, p_note)
  on conflict do nothing
  returning id into lid;

  if lid is null then
    return null; -- duplicate event: nothing happens, nothing is paid twice
  end if;

  if p_status = 'posted' then
    update public.credit_accounts set
      balance = balance + p_amount,
      total_earned = total_earned + case when p_type = 'earn' then p_amount else 0 end,
      total_spent = total_spent + case when p_type = 'spend' then -p_amount when p_type = 'refund' then -p_amount else 0 end,
      updated_at = now()
    where user_id = p_user;
  end if;
  return lid;
end $$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile, credit account, preferences
-- The role from sign-up metadata is only a request: anything except 'receiver' becomes 'donor',
-- and admin/status/demo flags can never come from metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fn text := left(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 60);
  ln text := left(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 60);
  r text := case when new.raw_user_meta_data ->> 'primary_role' = 'receiver' then 'receiver' else 'donor' end;
  dn text;
begin
  dn := case
    when fn = '' then 'CampusShare member'
    when ln = '' then left(fn, 40)
    else left(fn, 36) || ' ' || left(ln, 1) || '.'
  end;
  if char_length(dn) < 2 then dn := 'CampusShare member'; end if;

  insert into public.profiles (id, first_name, last_name, display_name, primary_role)
  values (new.id, fn, ln, dn, r);
  insert into public.credit_accounts (user_id) values (new.id);
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security for this file's tables
-- ---------------------------------------------------------------------------
alter table public.platform_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;

create policy settings_read on public.platform_settings for select using (true);

create policy profiles_read_own on public.profiles for select using (id = auth.uid());
create policy profiles_read_admin on public.profiles for select using (public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy prefs_all_own on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_prefs_all_own on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_read_own on public.notifications for select using (user_id = auth.uid());

create policy credit_accounts_read_own on public.credit_accounts for select using (user_id = auth.uid());
create policy credit_accounts_read_admin on public.credit_accounts for select using (public.is_admin());
create policy credit_ledger_read_own on public.credit_ledger for select using (user_id = auth.uid());
create policy credit_ledger_read_admin on public.credit_ledger for select using (public.is_admin());

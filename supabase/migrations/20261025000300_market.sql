-- Farmer marketplace: seller profiles, produce listings, images, enquiries, favourites.
-- No checkout: buyers send enquiries and farmers reply. No payment is simulated.

create table public.farmer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  farm_name text not null check (char_length(farm_name) between 2 and 80),
  farmer_name text not null check (char_length(farmer_name) between 2 and 80),
  county text not null,
  town text,
  description text check (description is null or char_length(description) <= 600),
  categories text[] not null default '{}',
  contact_note text check (contact_note is null or char_length(contact_note) <= 200),
  avatar_path text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger farmer_profiles_touch before update on public.farmer_profiles
  for each row execute function public.touch_updated_at();

create or replace function public.farmer_flag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set is_farmer = true where id = new.user_id;
  return new;
end $$;
create trigger farmer_profiles_flag after insert on public.farmer_profiles
  for each row execute function public.farmer_flag();

create table public.produce_listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles (user_id) on delete cascade,
  name text not null check (char_length(name) between 3 and 120),
  category text not null check (category in
    ('vegetables', 'fruits', 'grains', 'legumes', 'poultry_eggs', 'dairy', 'seeds_seedlings', 'other')),
  description text check (description is null or char_length(description) <= 1000),
  price numeric not null check (price >= 0),
  unit text not null check (unit in ('kg', 'bunch', 'crate', 'bag', 'piece', 'head', 'litre', 'tray')),
  quantity_available numeric not null check (quantity_available >= 0),
  harvest_date date,
  available_from date,
  county text not null,
  town text,
  delivery_options text[] not null default '{}',
  keywords text[] not null default '{}',
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'sold_out', 'removed')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index produce_listings_browse on public.produce_listings (status, category, county);
create index produce_listings_farmer on public.produce_listings (farmer_id, created_at desc);

create or replace function public.listings_guard() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_demo := false;
      if new.status = 'removed' then raise exception 'protected_field'; end if;
    else
      if new.farmer_id <> old.farmer_id or new.is_demo is distinct from old.is_demo then raise exception 'protected_field'; end if;
      -- Only moderators can remove, and a removed listing stays removed.
      if new.status = 'removed' and old.status <> 'removed' then raise exception 'protected_field'; end if;
      if old.status = 'removed' then raise exception 'listing_removed'; end if;
    end if;
  end if;
  if new.status = 'active' and new.quantity_available = 0 then new.status := 'sold_out'; end if;
  if new.status = 'sold_out' and new.quantity_available > 0 then new.status := 'active'; end if;
  return new;
end $$;
create trigger listings_guard before insert or update on public.produce_listings
  for each row execute function public.listings_guard();

create table public.produce_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index produce_images_listing on public.produce_images (listing_id, sort_order);

create table public.product_enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 5 and 1000),
  quantity_interest numeric check (quantity_interest is null or quantity_interest > 0),
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  reply text check (reply is null or char_length(reply) <= 1000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index product_enquiries_farmer on public.product_enquiries (farmer_id, created_at desc);
create index product_enquiries_buyer on public.product_enquiries (buyer_id, created_at desc);

create table public.favourites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.produce_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.farmer_profiles enable row level security;
alter table public.produce_listings enable row level security;
alter table public.produce_images enable row level security;
alter table public.product_enquiries enable row level security;
alter table public.favourites enable row level security;

create policy farmer_profiles_read on public.farmer_profiles for select using (true);
create policy farmer_profiles_insert on public.farmer_profiles for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy farmer_profiles_update on public.farmer_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy listings_read on public.produce_listings for select using (
  status in ('active', 'sold_out') or farmer_id = auth.uid() or public.is_admin()
);
create policy listings_insert on public.produce_listings for insert
  with check (farmer_id = auth.uid() and public.is_active_user());
create policy listings_update on public.produce_listings for update
  using (farmer_id = auth.uid() and public.is_active_user()) with check (farmer_id = auth.uid());
create policy listings_delete on public.produce_listings for delete using (farmer_id = auth.uid());

create policy produce_images_read on public.produce_images for select using (
  exists (select 1 from public.produce_listings l where l.id = listing_id)
);
create policy produce_images_insert on public.produce_images for insert
  with check (
    exists (select 1 from public.produce_listings l where l.id = listing_id and l.farmer_id = auth.uid())
    and storage_path like auth.uid()::text || '/%'
  );
create policy produce_images_delete on public.produce_images for delete
  using (exists (select 1 from public.produce_listings l where l.id = listing_id and l.farmer_id = auth.uid()));

create policy enquiries_read on public.product_enquiries for select
  using (buyer_id = auth.uid() or farmer_id = auth.uid() or public.is_admin());

create policy favourites_own on public.favourites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Enquiry workflow (functions, so rate limits and notifications cannot be skipped)
-- ---------------------------------------------------------------------------
create or replace function public.send_enquiry(p_listing uuid, p_message text, p_quantity numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  l public.produce_listings;
  eid uuid;
  sent integer;
  who text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_suspended'; end if;
  select * into l from public.produce_listings where id = p_listing;
  if not found or l.status not in ('active', 'sold_out') then raise exception 'listing_unavailable'; end if;
  if l.farmer_id = auth.uid() then raise exception 'own_listing'; end if;

  select count(*) into sent from public.product_enquiries where buyer_id = auth.uid() and created_at >= now() - interval '1 day';
  if sent >= public.setting_num('enquiries_per_day', 10) then raise exception 'rate_limited'; end if;

  insert into public.product_enquiries (listing_id, buyer_id, farmer_id, message, quantity_interest)
  values (l.id, auth.uid(), l.farmer_id, trim(p_message), p_quantity) returning id into eid;

  select display_name into who from public.profiles where id = auth.uid();
  perform public.notify(l.farmer_id, 'enquiry_new', 'New enquiry', coalesce(who, 'A buyer') || ' asked about ' || l.name || '.', '/farmer-market/enquiries');
  return eid;
end $$;

create or replace function public.reply_enquiry(p_enquiry uuid, p_reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.product_enquiries; l_name text;
begin
  select * into e from public.product_enquiries where id = p_enquiry for update;
  if not found or e.farmer_id is distinct from auth.uid() then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_reply, ''))) < 2 then raise exception 'reply_required'; end if;
  update public.product_enquiries set reply = left(trim(p_reply), 1000), status = 'replied', replied_at = now() where id = e.id;
  select name into l_name from public.produce_listings where id = e.listing_id;
  perform public.notify(e.buyer_id, 'enquiry_reply', 'The farmer replied', 'You have a reply about ' || coalesce(l_name, 'your enquiry') || '.', '/farmer-market/enquiries');
end $$;

create or replace function public.close_enquiry(p_enquiry uuid) returns void
language sql security definer set search_path = '' as $$
  update public.product_enquiries set status = 'closed'
  where id = p_enquiry and (buyer_id = auth.uid() or farmer_id = auth.uid())
$$;

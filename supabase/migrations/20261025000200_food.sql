-- Food rescue: donations, private pickup details, images, reservations, events.

create table public.food_donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in
    ('cooked_meals', 'fresh_vegetables', 'fruits', 'bakery', 'grains_cereals', 'packaged', 'dairy', 'other')),
  description text check (description is null or char_length(description) <= 500),
  quantity numeric not null check (quantity > 0),
  quantity_remaining numeric not null check (quantity_remaining >= 0),
  unit text not null check (unit in ('kg', 'g', 'portions', 'pieces', 'boxes', 'bags', 'litres')),
  portions integer check (portions is null or portions > 0),
  est_kg numeric,
  prepared_at timestamptz,
  expires_at timestamptz not null,
  storage_conditions text check (storage_conditions is null or char_length(storage_conditions) <= 200),
  county text not null,
  town text not null,
  area_label text check (area_label is null or char_length(area_label) <= 80),
  lat numeric(6, 2),
  lng numeric(6, 2),
  dietary text[] not null default '{}',
  allergens text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 300),
  status text not null default 'draft'
    check (status in ('draft', 'available', 'reserved', 'collected', 'expired', 'cancelled')),
  is_demo boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint remaining_within_quantity check (quantity_remaining <= quantity)
);
create index food_donations_discovery on public.food_donations (status, expires_at);
create index food_donations_donor on public.food_donations (donor_id, created_at desc);
create index food_donations_county on public.food_donations (county, town);

-- Exact pickup details. Visible only to the donor and to receivers holding an active reservation.
create table public.donation_private (
  donation_id uuid primary key references public.food_donations (id) on delete cascade,
  pickup_address text not null check (char_length(pickup_address) between 3 and 200),
  pickup_instructions text check (pickup_instructions is null or char_length(pickup_instructions) <= 300),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 25)
);

create table public.donation_images (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.food_donations (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index donation_images_donation on public.donation_images (donation_id, sort_order);

create table public.food_reservations (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.food_donations (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved', 'collected', 'cancelled', 'expired')),
  code_attempts integer not null default 0,
  reminded_at timestamptz,
  collected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index food_reservations_receiver on public.food_reservations (receiver_id, created_at desc);
create index food_reservations_donation on public.food_reservations (donation_id, status);

-- The 6-digit handover code lives apart from the reservation so that only the receiver can read it.
-- The donor must be told the code in person, which is what makes a collection "verified".
create table public.reservation_codes (
  reservation_id uuid primary key references public.food_reservations (id) on delete cascade,
  code text not null
);

create table public.donation_events (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.food_donations (id) on delete cascade,
  actor_id uuid,
  event text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index donation_events_donation on public.donation_events (donation_id, created_at);

-- ---------------------------------------------------------------------------
-- Guard: what a browser session may change on a donation
-- ---------------------------------------------------------------------------
create or replace function public.donations_guard() returns trigger
language plpgsql as $$
declare
  browser boolean := current_user in ('authenticated', 'anon');
begin
  new.est_kg := case new.unit when 'kg' then new.quantity when 'g' then new.quantity / 1000 else null end;
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if browser then
      if new.status <> 'draft' then
        raise exception 'new_donations_start_as_draft';
      end if;
      new.quantity_remaining := new.quantity;
      new.is_demo := false;
    end if;
    return new;
  end if;

  -- UPDATE
  if browser then
    if new.donor_id <> old.donor_id or new.is_demo is distinct from old.is_demo
       or new.published_at is distinct from old.published_at then
      raise exception 'protected_field';
    end if;

    if new.status is distinct from old.status then
      if not (old.status = 'draft' and new.status = 'available') then
        raise exception 'use_cancel_action';
      end if;
      if new.expires_at <= now() then raise exception 'deadline_in_past'; end if;
      if not exists (select 1 from public.donation_images i where i.donation_id = old.id) then
        raise exception 'photo_required';
      end if;
      if not exists (select 1 from public.donation_private p where p.donation_id = old.id) then
        raise exception 'pickup_details_required';
      end if;
      new.published_at := now();
    end if;

    if new.quantity is distinct from old.quantity or new.unit is distinct from old.unit then
      if exists (select 1 from public.food_reservations r where r.donation_id = old.id and r.status in ('reserved', 'collected')) then
        raise exception 'quantity_locked';
      end if;
      new.quantity_remaining := new.quantity;
    else
      new.quantity_remaining := old.quantity_remaining;
    end if;
  end if;
  return new;
end $$;

create trigger donations_guard before insert or update on public.food_donations
  for each row execute function public.donations_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.food_donations enable row level security;
alter table public.donation_private enable row level security;
alter table public.donation_images enable row level security;
alter table public.food_reservations enable row level security;
alter table public.reservation_codes enable row level security;
alter table public.donation_events enable row level security;

create or replace function public.has_active_reservation(p_donation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.food_reservations r
    where r.donation_id = p_donation and r.receiver_id = auth.uid() and r.status in ('reserved', 'collected')
  )
$$;

-- Public: food that is genuinely available. Owners, reservers and admins also see their own.
create policy donations_read on public.food_donations for select using (
  (status = 'available' and expires_at > now() and quantity_remaining > 0)
  or donor_id = auth.uid()
  or public.has_active_reservation(id)
  or public.is_admin()
);
create policy donations_insert on public.food_donations for insert
  with check (donor_id = auth.uid() and public.is_active_user());
create policy donations_update on public.food_donations for update
  using (donor_id = auth.uid() and status in ('draft', 'available') and public.is_active_user())
  with check (donor_id = auth.uid());
create policy donations_delete on public.food_donations for delete
  using (donor_id = auth.uid() and status = 'draft');

create policy donation_private_read on public.donation_private for select using (
  exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid())
  or exists (select 1 from public.food_reservations r where r.donation_id = donation_private.donation_id
             and r.receiver_id = auth.uid() and r.status = 'reserved')
  or public.is_admin()
);
create policy donation_private_write on public.donation_private for insert
  with check (exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid() and d.status in ('draft', 'available')));
create policy donation_private_update on public.donation_private for update
  using (exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid() and d.status in ('draft', 'available')));

create policy donation_images_read on public.donation_images for select using (
  exists (select 1 from public.food_donations d where d.id = donation_id)  -- inherits donation visibility
);
create policy donation_images_insert on public.donation_images for insert
  with check (
    exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid() and d.status in ('draft', 'available'))
    and (storage_path like auth.uid()::text || '/%')
  );
create policy donation_images_delete on public.donation_images for delete
  using (exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid() and d.status in ('draft', 'available')));

create policy reservations_read_receiver on public.food_reservations for select using (receiver_id = auth.uid());
create policy reservations_read_donor on public.food_reservations for select using (
  exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid())
);
create policy reservations_read_admin on public.food_reservations for select using (public.is_admin());

create policy codes_read_receiver on public.reservation_codes for select using (
  exists (select 1 from public.food_reservations r where r.id = reservation_id and r.receiver_id = auth.uid())
);

create policy events_read_donor on public.donation_events for select using (
  exists (select 1 from public.food_donations d where d.id = donation_id and d.donor_id = auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Internal: log an event
-- ---------------------------------------------------------------------------
create or replace function public.log_donation_event(p_donation uuid, p_actor uuid, p_event text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.donation_events (donation_id, actor_id, event, detail) values (p_donation, p_actor, p_event, p_detail)
$$;

-- ---------------------------------------------------------------------------
-- Reserve: the server decides, under a row lock, so two people can never take the same food.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_donation(p_donation uuid, p_quantity numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.food_donations;
  rid uuid;
  active integer;
  code text;
  who text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_suspended'; end if;

  select * into d from public.food_donations where id = p_donation for update;
  if not found or d.status <> 'available' or d.expires_at <= now() or d.quantity_remaining <= 0 then
    raise exception 'donation_unavailable';
  end if;
  if d.donor_id = auth.uid() then raise exception 'own_donation'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > d.quantity_remaining then
    raise exception 'invalid_quantity';
  end if;

  select count(*) into active from public.food_reservations where receiver_id = auth.uid() and status = 'reserved';
  if active >= public.setting_num('max_active_reservations', 5) then raise exception 'too_many_reservations'; end if;

  insert into public.food_reservations (donation_id, receiver_id, quantity)
  values (d.id, auth.uid(), p_quantity) returning id into rid;

  -- 6 digits from a CSPRNG-backed uuid
  code := lpad((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
  insert into public.reservation_codes (reservation_id, code) values (rid, code);

  update public.food_donations set
    quantity_remaining = quantity_remaining - p_quantity,
    status = case when quantity_remaining - p_quantity <= 0 then 'reserved' else 'available' end
  where id = d.id;

  select display_name into who from public.profiles where id = auth.uid();
  perform public.notify(d.donor_id, 'donation_reserved', 'Donation reserved',
    coalesce(who, 'Someone') || ' reserved ' || p_quantity || ' ' || d.unit || ' of ' || d.title || '.', '/activity');
  perform public.notify(auth.uid(), 'reservation_confirmed', 'Reservation confirmed',
    'Your reservation for ' || d.title || ' is confirmed. Open My Activity for pickup details and your handover code.', '/activity');
  perform public.log_donation_event(d.id, auth.uid(), 'reserved', jsonb_build_object('quantity', p_quantity, 'reservation', rid));
  return rid;
end $$;

create or replace function public.cancel_reservation(p_reservation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.food_reservations;
  d public.food_donations;
begin
  select * into r from public.food_reservations where id = p_reservation for update;
  if not found then raise exception 'not_found'; end if;
  select * into d from public.food_donations where id = r.donation_id for update;
  if auth.uid() is distinct from r.receiver_id and auth.uid() is distinct from d.donor_id then
    raise exception 'not_allowed';
  end if;
  if r.status <> 'reserved' then raise exception 'not_cancellable'; end if;

  update public.food_reservations set status = 'cancelled', cancelled_at = now() where id = r.id;
  if d.status in ('available', 'reserved') and d.expires_at > now() then
    update public.food_donations set quantity_remaining = quantity_remaining + r.quantity, status = 'available' where id = d.id;
  end if;

  if auth.uid() = r.receiver_id then
    perform public.notify(d.donor_id, 'reservation_cancelled', 'Reservation cancelled',
      'A reservation for ' || d.title || ' was cancelled. The food is available again.', '/activity');
  else
    perform public.notify(r.receiver_id, 'reservation_cancelled', 'Reservation cancelled by donor',
      'The donor cancelled your reservation for ' || d.title || '.', '/activity');
  end if;
  perform public.log_donation_event(d.id, auth.uid(), 'reservation_cancelled', jsonb_build_object('reservation', r.id));
end $$;

-- ---------------------------------------------------------------------------
-- Credits for a verified collection (idempotent, capped, and held when it looks suspicious)
-- ---------------------------------------------------------------------------
create or replace function public.award_collection_credits(p_reservation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.food_reservations;
  d public.food_donations;
  v_amount integer;
  used integer;
  pair_today integer;
  st text := 'posted';
  donor_demo boolean;
begin
  if not public.setting_bool('credits_enabled', true) then return; end if;
  select * into r from public.food_reservations where id = p_reservation;
  select * into d from public.food_donations where id = r.donation_id;
  select is_demo into donor_demo from public.profiles where id = d.donor_id;
  if donor_demo then return; end if; -- demo activity never earns real credits

  v_amount := case
    when d.unit = 'kg' then round(r.quantity * public.setting_num('credits_per_kg', 10))
    when d.unit = 'g' then round(r.quantity / 1000 * public.setting_num('credits_per_kg', 10))
    else round(r.quantity * public.setting_num('credits_per_unit', 5))
  end;
  v_amount := greatest(v_amount, 1);

  select coalesce(sum(l.amount), 0) into used from public.credit_ledger l
  where l.user_id = d.donor_id and l.entry_type = 'earn' and l.status in ('posted', 'held') and l.created_at >= date_trunc('day', now());
  v_amount := least(v_amount, greatest(public.setting_num('daily_credit_cap', 300)::integer - used, 0));
  if v_amount <= 0 then return; end if;

  select count(*) into pair_today from public.food_reservations fr
  join public.food_donations fd on fd.id = fr.donation_id
  where fd.donor_id = d.donor_id and fr.receiver_id = r.receiver_id and fr.status = 'collected'
    and fr.collected_at >= date_trunc('day', now());
  if pair_today > public.setting_num('same_receiver_daily_limit', 2) then st := 'held'; end if;

  if public.post_credit(d.donor_id, v_amount, 'earn', 'reservation', r.id, st,
        case when st = 'held' then 'Held for review: repeated collections with the same receiver' else 'Verified collection: ' || d.title end) is not null then
    if st = 'posted' then
      perform public.notify(d.donor_id, 'credits_awarded', 'Promotional credits awarded',
        'You earned ' || v_amount || ' credits for ' || d.title || '.', '/credits');
    else
      perform public.notify(d.donor_id, 'credits_held', 'Credits held for review',
        v_amount || ' credits for ' || d.title || ' are held while we review repeated collections.', '/credits');
    end if;
  end if;
end $$;

-- Donor confirms collection by entering the code the receiver shows in person.
-- A wrong code returns a result instead of raising so the attempt counter persists.
create or replace function public.confirm_collection(p_reservation uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.food_reservations;
  d public.food_donations;
  real_code text;
begin
  select * into r from public.food_reservations where id = p_reservation for update;
  if not found then raise exception 'not_found'; end if;
  select * into d from public.food_donations where id = r.donation_id for update;
  if d.donor_id is distinct from auth.uid() then raise exception 'not_allowed'; end if;
  if r.status <> 'reserved' then raise exception 'not_collectable'; end if;
  if r.code_attempts >= 5 then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;

  select code into real_code from public.reservation_codes where reservation_id = r.id;
  if real_code is distinct from trim(p_code) then
    update public.food_reservations set code_attempts = code_attempts + 1 where id = r.id;
    return jsonb_build_object('ok', false, 'reason', 'wrong_code', 'attempts_left', 4 - r.code_attempts);
  end if;

  update public.food_reservations set status = 'collected', collected_at = now() where id = r.id;
  if d.quantity_remaining = 0 and not exists (
    select 1 from public.food_reservations x where x.donation_id = d.id and x.status = 'reserved'
  ) then
    update public.food_donations set status = 'collected' where id = d.id;
  end if;

  perform public.notify(r.receiver_id, 'donation_collected', 'Collection confirmed',
    'Your collection of ' || d.title || ' was confirmed. Thank you.', '/activity');
  perform public.notify(d.donor_id, 'donation_collected', 'Donation collected',
    d.title || ' was collected and verified.', '/activity');
  perform public.log_donation_event(d.id, auth.uid(), 'collected', jsonb_build_object('reservation', r.id));
  perform public.award_collection_credits(r.id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cancel_donation(p_donation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.food_donations;
  rv record;
begin
  select * into d from public.food_donations where id = p_donation for update;
  if not found then raise exception 'not_found'; end if;
  if d.donor_id is distinct from auth.uid() and not public.is_admin() then raise exception 'not_allowed'; end if;
  if d.status not in ('draft', 'available', 'reserved') then raise exception 'not_cancellable'; end if;

  for rv in select * from public.food_reservations where donation_id = d.id and status = 'reserved' for update loop
    update public.food_reservations set status = 'cancelled', cancelled_at = now() where id = rv.id;
    perform public.notify(rv.receiver_id, 'donation_cancelled', 'Donation cancelled',
      d.title || ' is no longer available.', '/activity');
  end loop;
  update public.food_donations set status = 'cancelled' where id = d.id;
  perform public.log_donation_event(d.id, auth.uid(), 'cancelled');
end $$;

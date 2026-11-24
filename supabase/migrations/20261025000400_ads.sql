-- Advertising: advertiser profiles, campaigns, events (impressions and clicks), future payments.
--
-- Campaigns are funded from promotional credits. Funding debits the ledger once; rejection or ending
-- refunds the unused part once. There is no card or M-Pesa path yet: ad_transactions exists so a
-- provider can be added, and nothing writes to it today.

create table public.advertiser_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 80),
  business_type text not null check (business_type in
    ('agri_supplier', 'farmer', 'restaurant', 'supermarket', 'food_business', 'local_business', 'community_org', 'service_provider')),
  county text,
  town text,
  description text check (description is null or char_length(description) <= 400),
  website text check (website is null or website ~* '^https?://'),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger advertiser_profiles_touch before update on public.advertiser_profiles
  for each row execute function public.touch_updated_at();

create or replace function public.advertiser_flag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set is_advertiser = true where id = new.user_id;
  return new;
end $$;
create trigger advertiser_profiles_flag after insert on public.advertiser_profiles
  for each row execute function public.advertiser_flag();

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.advertiser_profiles (user_id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  objective text not null default 'awareness' check (objective in ('awareness', 'traffic', 'promote_listing', 'promote_donation')),
  campaign_type text not null check (campaign_type in
    ('sponsored_food', 'sponsored_produce', 'agri_supplier', 'community_business', 'educational')),
  headline text not null check (char_length(headline) between 5 and 70),
  description text check (description is null or char_length(description) <= 200),
  image_path text,
  destination_url text not null check (destination_url ~* '^https?://[^\s]+$'),
  cta_label text not null default 'Learn more' check (char_length(cta_label) between 2 and 20),
  target_counties text[] not null default '{}',
  target_categories text[] not null default '{}',
  placements text[] not null default '{dashboard,find_food,farmer_market}'
    check (placements <@ array['dashboard', 'find_food', 'farmer_market', 'promote', 'recommendations']),
  start_date date not null,
  end_date date not null,
  budget_credits integer not null check (budget_credits >= 0),
  spent_credits integer not null default 0 check (spent_credits >= 0),
  refunded_credits integer not null default 0 check (refunded_credits >= 0),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'credits_applied', 'awaiting_payment', 'paid', 'refunded')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'ended')),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  summary_sent_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dates_ordered check (end_date >= start_date),
  constraint spend_within_budget check (spent_credits <= budget_credits)
);
create index ad_campaigns_owner on public.ad_campaigns (owner_id, created_at desc);
create index ad_campaigns_live on public.ad_campaigns (status, start_date, end_date);

-- Browsers may edit campaign content only while it is a draft or was rejected. Money and status
-- are never writable from a browser.
create or replace function public.campaigns_guard() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.status <> 'draft' or new.payment_status <> 'unpaid' or new.spent_credits <> 0 or new.refunded_credits <> 0 then
        raise exception 'protected_field';
      end if;
      new.is_demo := false;
    else
      if new.owner_id <> old.owner_id or new.status is distinct from old.status
         or new.payment_status is distinct from old.payment_status
         or new.spent_credits is distinct from old.spent_credits
         or new.refunded_credits is distinct from old.refunded_credits
         or new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.rejection_reason is distinct from old.rejection_reason
         or new.summary_sent_at is distinct from old.summary_sent_at
         or new.is_demo is distinct from old.is_demo then
        raise exception 'protected_field';
      end if;
      if old.status not in ('draft', 'rejected') then raise exception 'campaign_locked'; end if;
      -- Budget is what gets debited, so it cannot change once funds were taken.
      if old.payment_status <> 'unpaid' and new.budget_credits is distinct from old.budget_credits then
        raise exception 'campaign_locked';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger campaigns_guard before insert or update on public.ad_campaigns
  for each row execute function public.campaigns_guard();

create table public.ad_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  kind text not null check (kind in ('impression', 'click')),
  placement text not null,
  viewer_id uuid not null,
  session_key text not null check (char_length(session_key) <= 64),
  charged_credits integer not null default 0,
  created_at timestamptz not null default now()
);
create index ad_events_campaign on public.ad_events (campaign_id, kind, created_at desc);
create index ad_events_dedupe on public.ad_events (campaign_id, viewer_id, kind, created_at desc);

-- Reserved for a real payment provider. Written only by the service role.
create table public.ad_transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  provider_ref text,
  amount_kes numeric not null check (amount_kes > 0),
  currency text not null default 'KES',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.advertiser_profiles enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_events enable row level security;
alter table public.ad_transactions enable row level security;

create policy advertiser_profiles_read on public.advertiser_profiles for select
  using (user_id = auth.uid() or public.is_admin());
create policy advertiser_profiles_insert on public.advertiser_profiles for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy advertiser_profiles_update on public.advertiser_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public visitors see only approved, live campaigns that still have budget.
create policy campaigns_read on public.ad_campaigns for select using (
  owner_id = auth.uid()
  or public.is_admin()
  or (status = 'approved' and current_date between start_date and end_date and spent_credits < budget_credits)
);
create policy campaigns_insert on public.ad_campaigns for insert
  with check (owner_id = auth.uid() and public.is_active_user());
create policy campaigns_update on public.ad_campaigns for update
  using (owner_id = auth.uid() and status in ('draft', 'rejected') and public.is_active_user())
  with check (owner_id = auth.uid());
create policy campaigns_delete on public.ad_campaigns for delete
  using (owner_id = auth.uid() and status = 'draft');

create policy ad_events_read_owner on public.ad_events for select using (
  exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  or public.is_admin()
);

create policy ad_transactions_read_own on public.ad_transactions for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Funding and lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.submit_campaign(p_campaign uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.ad_campaigns;
begin
  select * into c from public.ad_campaigns where id = p_campaign for update;
  if not found or c.owner_id is distinct from auth.uid() then raise exception 'not_allowed'; end if;
  if not public.is_active_user() then raise exception 'account_suspended'; end if;
  if c.status not in ('draft', 'rejected') then raise exception 'not_submittable'; end if;
  if c.budget_credits < public.setting_num('min_campaign_budget', 50) then raise exception 'budget_too_low'; end if;
  if c.end_date < current_date then raise exception 'dates_in_past'; end if;

  -- Debit once. After a rejection the credits were refunded (payment_status = 'refunded'), so they are taken again.
  if c.payment_status in ('unpaid', 'refunded') then
    perform public.post_credit(c.owner_id, -c.budget_credits, 'spend', 'campaign', gen_random_uuid(), 'posted',
      'Campaign budget: ' || c.name);
    update public.ad_campaigns set payment_status = 'credits_applied', refunded_credits = 0 where id = c.id;
  end if;
  update public.ad_campaigns set status = 'pending_review', rejection_reason = null where id = c.id;
  perform public.notify(c.owner_id, 'campaign_submitted', 'Campaign submitted',
    c.name || ' is waiting for review.', '/promote/' || c.id);
end $$;

-- Refund whatever has not been spent. Safe to call twice: it refunds only the difference.
create or replace function public.refund_unspent(p_campaign uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.ad_campaigns; amt integer;
begin
  select * into c from public.ad_campaigns where id = p_campaign for update;
  if not found or c.payment_status <> 'credits_applied' then return 0; end if;
  amt := c.budget_credits - c.spent_credits - c.refunded_credits;
  if amt > 0 then
    perform public.post_credit(c.owner_id, amt, 'refund', 'campaign', gen_random_uuid(), 'posted', 'Unused budget returned: ' || c.name);
    update public.ad_campaigns set refunded_credits = refunded_credits + amt where id = c.id;
  end if;
  return greatest(amt, 0);
end $$;

create or replace function public.set_campaign_paused(p_campaign uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.ad_campaigns;
begin
  select * into c from public.ad_campaigns where id = p_campaign for update;
  if not found or c.owner_id is distinct from auth.uid() then raise exception 'not_allowed'; end if;
  if p_paused and c.status = 'approved' then
    update public.ad_campaigns set status = 'paused' where id = c.id;
  elsif not p_paused and c.status = 'paused' then
    if c.reviewed_by is null then raise exception 'not_allowed'; end if;
    update public.ad_campaigns set status = 'approved' where id = c.id;
  else
    raise exception 'invalid_state';
  end if;
end $$;

create or replace function public.end_campaign(p_campaign uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.ad_campaigns; back integer := 0;
begin
  select * into c from public.ad_campaigns where id = p_campaign for update;
  if not found or (c.owner_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'not_allowed'; end if;
  if c.status not in ('approved', 'paused', 'pending_review') then raise exception 'invalid_state'; end if;
  update public.ad_campaigns set status = 'ended' where id = c.id;
  back := public.refund_unspent(c.id);
  return back;
end $$;

-- ---------------------------------------------------------------------------
-- Serving and tracking
-- ---------------------------------------------------------------------------
-- Returns only what is needed to draw the ad. The destination URL is not included: it is released
-- by record_ad_event when a real click is recorded.
create or replace function public.serve_ads(p_placement text, p_county text default null, p_category text default null, p_limit integer default 3)
returns table (id uuid, headline text, description text, image_path text, cta_label text, campaign_type text, advertiser text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.headline, c.description, c.image_path, c.cta_label, c.campaign_type, a.business_name
  from public.ad_campaigns c
  join public.advertiser_profiles a on a.user_id = c.owner_id
  join public.profiles p on p.id = c.owner_id and p.status = 'active'
  where auth.uid() is not null
    and c.status = 'approved'
    and current_date between c.start_date and c.end_date
    and c.spent_credits + public.setting_num('cpc_credits', 5) <= c.budget_credits
    and p_placement = any (c.placements)
    and (cardinality(c.target_counties) = 0 or p_county is null or p_county = any (c.target_counties))
    and (cardinality(c.target_categories) = 0 or p_category is null or p_category = any (c.target_categories))
  order by random()
  limit least(greatest(p_limit, 1), 6)
$$;

-- Records an impression or a click and, for a click, returns where to send the visitor.
-- Rules: signed-in viewers only; owners never count; one impression per viewer per campaign per
-- 30 minutes; a click needs a recent impression from the same viewer; one billable click per viewer
-- per campaign per 10 minutes. Budget is charged inside the lock and ends the campaign when spent.
create or replace function public.record_ad_event(p_campaign uuid, p_kind text, p_placement text, p_session text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.ad_campaigns;
  cpc integer := public.setting_num('cpc_credits', 5)::integer;
  charge integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('counted', false, 'reason', 'anonymous'); end if;
  if p_kind not in ('impression', 'click') then raise exception 'invalid_kind'; end if;

  select * into c from public.ad_campaigns where id = p_campaign for update;
  if not found or c.status <> 'approved' or current_date not between c.start_date and c.end_date then
    return jsonb_build_object('counted', false, 'reason', 'not_live');
  end if;
  if c.owner_id = auth.uid() then
    return jsonb_build_object('counted', false, 'reason', 'owner', 'url', case when p_kind = 'click' then c.destination_url end);
  end if;

  if p_kind = 'impression' then
    if exists (select 1 from public.ad_events e where e.campaign_id = c.id and e.viewer_id = auth.uid()
               and e.kind = 'impression' and e.created_at > now() - interval '30 minutes') then
      return jsonb_build_object('counted', false, 'reason', 'duplicate');
    end if;
    insert into public.ad_events (campaign_id, kind, placement, viewer_id, session_key)
    values (c.id, 'impression', left(p_placement, 30), auth.uid(), left(coalesce(p_session, ''), 64));
    return jsonb_build_object('counted', true);
  end if;

  -- click
  if not exists (select 1 from public.ad_events e where e.campaign_id = c.id and e.viewer_id = auth.uid()
                 and e.kind = 'impression' and e.created_at > now() - interval '30 minutes') then
    return jsonb_build_object('counted', false, 'reason', 'no_impression', 'url', c.destination_url);
  end if;
  if exists (select 1 from public.ad_events e where e.campaign_id = c.id and e.viewer_id = auth.uid()
             and e.kind = 'click' and e.created_at > now() - interval '10 minutes') then
    return jsonb_build_object('counted', false, 'reason', 'duplicate', 'url', c.destination_url);
  end if;
  if c.spent_credits + cpc > c.budget_credits then
    update public.ad_campaigns set status = 'ended' where id = c.id;
    perform public.refund_unspent(c.id);
    return jsonb_build_object('counted', false, 'reason', 'budget_spent');
  end if;

  charge := cpc;
  insert into public.ad_events (campaign_id, kind, placement, viewer_id, session_key, charged_credits)
  values (c.id, 'click', left(p_placement, 30), auth.uid(), left(coalesce(p_session, ''), 64), charge);
  update public.ad_campaigns set spent_credits = spent_credits + charge where id = c.id;

  if c.spent_credits + charge + cpc > c.budget_credits then
    update public.ad_campaigns set status = 'ended' where id = c.id;
    perform public.refund_unspent(c.id);
    perform public.notify(c.owner_id, 'campaign_ended', 'Campaign budget used up',
      c.name || ' has used its whole budget and has ended.', '/promote/' || c.id);
  end if;
  return jsonb_build_object('counted', true, 'url', c.destination_url, 'charged', charge);
end $$;

create or replace function public.campaign_stats(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.ad_campaigns; imps bigint; clicks bigint;
begin
  select * into c from public.ad_campaigns where id = p_campaign;
  if not found or (c.owner_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'not_allowed'; end if;
  select count(*) filter (where kind = 'impression'), count(*) filter (where kind = 'click')
    into imps, clicks from public.ad_events where campaign_id = c.id;
  return jsonb_build_object(
    'impressions', imps, 'clicks', clicks,
    'ctr', case when imps = 0 then 0 else round(clicks::numeric / imps * 100, 2) end,
    'spent', c.spent_credits, 'budget', c.budget_credits,
    'remaining', c.budget_credits - c.spent_credits - c.refunded_credits
  );
end $$;

create or replace function public.campaign_daily(p_campaign uuid, p_days integer default 14)
returns table (day date, impressions bigint, clicks bigint)
language plpgsql stable security definer set search_path = '' as $$
declare c public.ad_campaigns;
begin
  select * into c from public.ad_campaigns where ad_campaigns.id = p_campaign;
  if not found or (c.owner_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'not_allowed'; end if;
  return query
    select d::date,
           count(e.id) filter (where e.kind = 'impression'),
           count(e.id) filter (where e.kind = 'click')
    from generate_series(current_date - (least(greatest(p_days, 1), 90) - 1), current_date, interval '1 day') d
    left join public.ad_events e on e.campaign_id = c.id and e.created_at::date = d::date
    group by d order by d;
end $$;

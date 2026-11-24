-- Reports and moderation, leaderboard, impact totals, search, AI quota, maintenance,
-- storage buckets, and the privilege lockdown.

-- ---------------------------------------------------------------------------
-- Reports and moderation
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('donation', 'listing', 'campaign', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('unsafe_food', 'misleading', 'spam', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index reports_one_open on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_queue on public.reports (status, created_at);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  target_type text,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
alter table public.moderation_events enable row level security;
create policy reports_read_own on public.reports for select using (reporter_id = auth.uid());
create policy reports_read_admin on public.reports for select using (public.is_admin());
create policy moderation_read_admin on public.moderation_events for select using (public.is_admin());

create policy settings_admin_write on public.platform_settings for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.report_content(p_type text, p_target uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid; filed integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select count(*) into filed from public.reports where reporter_id = auth.uid() and created_at >= now() - interval '1 day';
  if filed >= public.setting_num('reports_per_day', 20) then raise exception 'rate_limited'; end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_type, p_target, p_reason, left(p_details, 500))
  returning id into rid;
  return rid;
exception when unique_violation then
  raise exception 'already_reported';
end $$;

create or replace function public.owner_of(p_type text, p_target uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'donation' then (select donor_id from public.food_donations where id = p_target)
    when 'listing' then (select farmer_id from public.produce_listings where id = p_target)
    when 'campaign' then (select owner_id from public.ad_campaigns where id = p_target)
    when 'user' then (select id from public.profiles where id = p_target)
  end
$$;

create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; owner uuid;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_action not in ('dismiss', 'remove_content', 'suspend_user') then raise exception 'invalid_action'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found or r.status <> 'open' then raise exception 'not_open'; end if;
  owner := public.owner_of(r.target_type, r.target_id);

  if p_action = 'remove_content' then
    if r.target_type = 'donation' then
      begin perform public.cancel_donation(r.target_id); exception when others then null; end;
    elsif r.target_type = 'listing' then
      update public.produce_listings set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'campaign' then
      update public.ad_campaigns set status = 'ended' where id = r.target_id and status in ('approved', 'paused', 'pending_review');
      perform public.refund_unspent(r.target_id);
    end if;
    perform public.notify(owner, 'content_removed', 'Content removed',
      'A moderator removed your ' || r.target_type || ' after a report. Reason: ' || coalesce(p_note, r.reason), '/help');
  elsif p_action = 'suspend_user' then
    update public.profiles set status = 'suspended' where id = owner and is_admin = false;
  end if;

  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
    resolved_by = auth.uid(), resolution_note = left(p_note, 500), resolved_at = now() where id = r.id;
  insert into public.moderation_events (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'report_' || p_action, r.target_type, r.target_id, left(p_note, 500));
end $$;

create or replace function public.admin_review_campaign(p_campaign uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.ad_campaigns;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  select * into c from public.ad_campaigns where id = p_campaign for update;
  if not found or c.status <> 'pending_review' then raise exception 'not_pending'; end if;

  if p_approve then
    if c.payment_status not in ('credits_applied', 'paid') then raise exception 'not_paid'; end if;
    update public.ad_campaigns set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null where id = c.id;
    perform public.notify(c.owner_id, 'campaign_approved', 'Campaign approved', c.name || ' is approved and will run from ' || c.start_date || '.', '/promote/' || c.id);
  else
    if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
    update public.ad_campaigns set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = left(p_reason, 300) where id = c.id;
    perform public.refund_unspent(c.id);
    update public.ad_campaigns set payment_status = 'refunded' where id = c.id and payment_status = 'credits_applied';
    perform public.notify(c.owner_id, 'campaign_rejected', 'Campaign needs changes', c.name || ' was not approved: ' || left(p_reason, 200) || ' Your credits were returned.', '/promote/' || c.id);
  end if;
  insert into public.moderation_events (admin_id, action, target_type, target_id, note)
  values (auth.uid(), case when p_approve then 'campaign_approved' else 'campaign_rejected' end, 'campaign', c.id, left(p_reason, 300));
end $$;

create or replace function public.admin_release_credit(p_ledger uuid, p_release boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.credit_ledger;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  select * into l from public.credit_ledger where id = p_ledger for update;
  if not found or l.status <> 'held' then raise exception 'not_held'; end if;
  perform 1 from public.credit_accounts where user_id = l.user_id for update;
  if p_release then
    update public.credit_ledger set status = 'posted' where id = l.id;
    update public.credit_accounts set balance = balance + l.amount, total_earned = total_earned + l.amount, updated_at = now() where user_id = l.user_id;
    perform public.notify(l.user_id, 'credits_awarded', 'Held credits released', l.amount || ' credits are now in your balance.', '/credits');
  else
    update public.credit_ledger set status = 'reversed' where id = l.id;
  end if;
  insert into public.moderation_events (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_release then 'credit_released' else 'credit_reversed' end, 'ledger', l.id);
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.platform_settings set value = p_value, updated_at = now() where key = p_key;
  if not found then raise exception 'unknown_setting'; end if;
  insert into public.moderation_events (admin_id, action, target_type, note) values (auth.uid(), 'setting_changed', 'setting', p_key || ' = ' || p_value::text);
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status'; end if;
  update public.profiles set status = p_status where id = p_user and is_admin = false;
  if not found then raise exception 'not_found'; end if;
  insert into public.moderation_events (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'user_' || p_status, 'user', p_user, left(p_note, 300));
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return jsonb_build_object(
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'pending_campaigns', (select count(*) from public.ad_campaigns where status = 'pending_review'),
    'held_credits', (select count(*) from public.credit_ledger where status = 'held'),
    'live_donations', (select count(*) from public.food_donations where status = 'available' and expires_at > now()),
    'active_listings', (select count(*) from public.produce_listings where status = 'active'),
    'members', (select count(*) from public.profiles),
    'suspended', (select count(*) from public.profiles where status = 'suspended')
  );
end $$;

-- ---------------------------------------------------------------------------
-- Impact totals and leaderboard. Demo records count only when 'demo_visible' is on.
-- ---------------------------------------------------------------------------
create or replace function public.platform_impact() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare show_demo boolean := public.setting_bool('demo_visible', false); res jsonb;
begin
  with c as (
    select r.receiver_id, d.donor_id, r.quantity, d.unit, d.quantity as dq, d.portions
    from public.food_reservations r
    join public.food_donations d on d.id = r.donation_id
    join public.profiles p on p.id = d.donor_id
    where r.status = 'collected' and (show_demo or not p.is_demo)
  )
  select jsonb_build_object(
    'kg', coalesce(sum(case unit when 'kg' then quantity when 'g' then quantity / 1000 else 0 end), 0),
    'meals', coalesce(sum(case when unit = 'portions' then quantity when portions is not null then round(portions * quantity / dq) else 0 end), 0),
    'people', count(distinct receiver_id),
    'partners', count(distinct donor_id),
    'collections', count(*),
    'co2e_kg_estimate', coalesce(sum(case unit when 'kg' then quantity when 'g' then quantity / 1000 else 0 end), 0)
      * public.setting_num('co2e_kg_per_kg_food', 2.5)
  ) into res from c;
  return res;
end $$;

create or replace function public.user_impact() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select jsonb_build_object(
    'donated_collections', (select count(*) from public.food_reservations r join public.food_donations d on d.id = r.donation_id
                            where d.donor_id = auth.uid() and r.status = 'collected'),
    'donated_kg', (select coalesce(sum(case d.unit when 'kg' then r.quantity when 'g' then r.quantity / 1000 else 0 end), 0)
                   from public.food_reservations r join public.food_donations d on d.id = r.donation_id
                   where d.donor_id = auth.uid() and r.status = 'collected'),
    'received_collections', (select count(*) from public.food_reservations where receiver_id = auth.uid() and status = 'collected'),
    'active_listings', (select count(*) from public.produce_listings where farmer_id = auth.uid() and status = 'active'),
    'open_enquiries', (select count(*) from public.product_enquiries where farmer_id = auth.uid() and status = 'new'),
    'active_reservations', (select count(*) from public.food_reservations where receiver_id = auth.uid() and status = 'reserved'),
    'live_donations', (select count(*) from public.food_donations where donor_id = auth.uid() and status in ('available', 'reserved'))
  ) into res;
  return res;
end $$;

-- p_kind: donors | food_saved | credits | farmers | impact     p_period: week | month | all
-- Scoring rules (documented in the app):
--   donors     verified collections
--   food_saved kilograms collected (units without a weight are not converted)
--   credits    promotional credits earned and posted (held credits do not count)
--   farmers    3 x answered enquiries + 1 x active listings
--   impact     verified collections + 2 x distinct receivers served
create or replace function public.leaderboard(p_kind text, p_period text default 'all', p_limit integer default 20)
returns table (rank bigint, display_name text, organisation_name text, county text, collections bigint, kg numeric, credits bigint, score numeric, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := case p_period when 'week' then now() - interval '7 days' when 'month' then now() - interval '30 days' else '-infinity'::timestamptz end;
  show_demo boolean := public.setting_bool('demo_visible', false);
begin
  if p_kind not in ('donors', 'food_saved', 'credits', 'farmers', 'impact') then raise exception 'invalid_kind'; end if;

  return query
  with eligible as (
    select p.id, p.display_name as dn, p.organisation_name as org, p.county as cty
    from public.profiles p
    where p.status = 'active' and p.show_on_leaderboard and (show_demo or not p.is_demo)
  ),
  col as (
    select d.donor_id as uid, count(*) as n,
           coalesce(sum(case d.unit when 'kg' then r.quantity when 'g' then r.quantity / 1000 else 0 end), 0) as kgs,
           count(distinct r.receiver_id) as served
    from public.food_reservations r join public.food_donations d on d.id = r.donation_id
    where r.status = 'collected' and r.collected_at >= since
    group by d.donor_id
  ),
  cr as (
    select user_id as uid, sum(amount) as earned from public.credit_ledger
    where entry_type = 'earn' and status = 'posted' and created_at >= since group by user_id
  ),
  fm as (
    select l.farmer_id as uid,
           count(*) filter (where l.status = 'active') as listings,
           (select count(*) from public.product_enquiries e where e.farmer_id = l.farmer_id and e.status in ('replied', 'closed') and e.replied_at >= since) as answered
    from public.produce_listings l group by l.farmer_id
  ),
  scored as (
    select e.dn, e.org, e.cty, e.id,
           coalesce(col.n, 0) as n, coalesce(col.kgs, 0) as kgs, coalesce(cr.earned, 0) as earned,
           case p_kind
             when 'donors' then coalesce(col.n, 0)::numeric
             when 'food_saved' then coalesce(col.kgs, 0)
             when 'credits' then coalesce(cr.earned, 0)::numeric
             when 'farmers' then coalesce(fm.answered, 0) * 3 + coalesce(fm.listings, 0)::numeric
             else coalesce(col.n, 0) + 2 * coalesce(col.served, 0)::numeric
           end as sc
    from eligible e
    left join col on col.uid = e.id
    left join cr on cr.uid = e.id
    left join fm on fm.uid = e.id
  ),
  ranked as (
    select s.*, rank() over (order by s.sc desc) as rk from scored s where s.sc > 0
  )
  select rk, dn, org, cty, n, round(kgs, 2), earned, sc, (id = auth.uid())
  from ranked
  where rk <= least(greatest(p_limit, 1), 100) or id = auth.uid()
  order by rk, dn;
end $$;

-- ---------------------------------------------------------------------------
-- Search across public content only
-- ---------------------------------------------------------------------------
create or replace function public.search_all(p_q text, p_county text default null, p_limit integer default 20)
returns table (kind text, id uuid, title text, subtitle text, county text, link text)
language plpgsql stable security definer set search_path = '' as $$
declare pat text;
begin
  p_q := trim(coalesce(p_q, ''));
  if char_length(p_q) < 2 then return; end if;
  pat := '%' || replace(replace(replace(left(p_q, 60), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  (select 'food'::text, d.id, d.title, d.town || ', ' || d.county, d.county, '/find-food/' || d.id
     from public.food_donations d
     where d.status = 'available' and d.expires_at > now() and d.quantity_remaining > 0
       and (d.title ilike pat or coalesce(d.description, '') ilike pat) and (p_county is null or d.county = p_county)
     limit p_limit)
  union all
  (select 'produce'::text, l.id, l.name, 'KSh ' || l.price || ' per ' || l.unit, l.county, '/farmer-market/' || l.id
     from public.produce_listings l
     where l.status = 'active' and (l.name ilike pat or coalesce(l.description, '') ilike pat or exists (select 1 from unnest(l.keywords) k where k ilike pat))
       and (p_county is null or l.county = p_county)
     limit p_limit)
  union all
  (select 'farmer'::text, f.user_id, f.farm_name, f.farmer_name, f.county, '/farmers/' || f.user_id
     from public.farmer_profiles f
     where (f.farm_name ilike pat or f.farmer_name ilike pat) and (p_county is null or f.county = p_county)
     limit p_limit);
end $$;

-- ---------------------------------------------------------------------------
-- AI usage quota (works on serverless: the counter lives in the database)
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  day date not null default current_date,
  calls integer not null default 0,
  primary key (user_id, feature, day)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_read_own on public.ai_usage for select using (user_id = auth.uid());

create or replace function public.ai_take_quota(p_feature text, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, feature, day, calls) values (auth.uid(), p_feature, current_date, 0) on conflict do nothing;
  update public.ai_usage set calls = calls + 1
  where user_id = auth.uid() and feature = p_feature and day = current_date and calls < p_limit
  returning calls into used;
  return used is not null;
end $$;

-- ---------------------------------------------------------------------------
-- Scheduled maintenance. Call from a cron (see /api/cron/maintenance). Service role only.
-- ---------------------------------------------------------------------------
create or replace function public.run_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  expired_d integer := 0; expired_r integer := 0; reminded integer := 0; ended_c integer := 0; summaries integer := 0;
  rv record; cv record; st jsonb;
begin
  -- Pickup reminders: reserved, deadline within two hours, not yet reminded
  for rv in select r.id, r.receiver_id, d.title from public.food_reservations r
            join public.food_donations d on d.id = r.donation_id
            where r.status = 'reserved' and r.reminded_at is null and d.expires_at > now() and d.expires_at <= now() + interval '2 hours' loop
    perform public.notify(rv.receiver_id, 'pickup_reminder', 'Pickup reminder', 'Collect ' || rv.title || ' soon: the pickup deadline is within two hours.', '/activity');
    update public.food_reservations set reminded_at = now() where id = rv.id;
    reminded := reminded + 1;
  end loop;

  -- Expire reservations and donations past their deadline
  for rv in select r.id, r.receiver_id, d.donor_id, d.title from public.food_reservations r
            join public.food_donations d on d.id = r.donation_id
            where r.status = 'reserved' and d.expires_at <= now() loop
    update public.food_reservations set status = 'expired' where id = rv.id;
    perform public.notify(rv.receiver_id, 'reservation_expired', 'Reservation expired', rv.title || ' passed its pickup deadline.', '/activity');
    expired_r := expired_r + 1;
  end loop;
  update public.food_donations set status = 'expired' where status in ('available', 'reserved') and expires_at <= now();
  get diagnostics expired_d = row_count;

  -- Campaigns past their end date
  for cv in select id from public.ad_campaigns where status in ('approved', 'paused') and end_date < current_date loop
    update public.ad_campaigns set status = 'ended' where id = cv.id;
    perform public.refund_unspent(cv.id);
    ended_c := ended_c + 1;
  end loop;

  -- One performance summary per ended campaign
  for cv in select c.id, c.owner_id, c.name, c.spent_credits from public.ad_campaigns c
            where c.status = 'ended' and c.summary_sent_at is null loop
    select count(*) filter (where kind = 'impression'), count(*) filter (where kind = 'click')
      into expired_r, reminded from public.ad_events where campaign_id = cv.id;
    perform public.notify(cv.owner_id, 'campaign_summary', 'Campaign results: ' || cv.name,
      expired_r || ' views and ' || reminded || ' clicks. ' || cv.spent_credits || ' credits used.', '/promote/' || cv.id);
    update public.ad_campaigns set summary_sent_at = now() where id = cv.id;
    summaries := summaries + 1;
  end loop;

  return jsonb_build_object('donations_expired', expired_d, 'campaigns_ended', ended_c, 'summaries', summaries);
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets and policies. Files live under <user id>/..., and only that user can write there.
-- Buckets are public-read so image URLs work in <img>; uploads are size- and type-limited.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('donation-images', 'donation-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('produce-images',  'produce-images',  true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('campaign-images', 'campaign-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',         'avatars',         true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "campusshare upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('donation-images', 'produce-images', 'campaign-images', 'avatars')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "campusshare update own folder" on storage.objects for update to authenticated
  using (bucket_id in ('donation-images', 'produce-images', 'campaign-images', 'avatars')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "campusshare delete own folder" on storage.objects for delete to authenticated
  using (bucket_id in ('donation-images', 'produce-images', 'campaign-images', 'avatars')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Safety nets
-- ---------------------------------------------------------------------------
-- 1) RLS on every table in public, even ones added later and forgotten.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 2) Function privileges: nothing is callable by browsers unless it is on the allowlist below.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Used inside RLS policies and views, so every role must be able to run them.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
grant execute on function public.has_active_reservation(uuid) to anon, authenticated;

-- Public reads
grant execute on function public.platform_impact() to anon, authenticated;
grant execute on function public.leaderboard(text, text, integer) to anon, authenticated;
grant execute on function public.search_all(text, text, integer) to anon, authenticated;

-- Signed-in actions. Each function checks auth.uid() and ownership itself.
grant execute on function
  public.mark_notifications_read(uuid[]), public.mark_all_notifications_read(),
  public.reserve_donation(uuid, numeric), public.cancel_reservation(uuid),
  public.confirm_collection(uuid, text), public.cancel_donation(uuid),
  public.send_enquiry(uuid, text, numeric), public.reply_enquiry(uuid, text), public.close_enquiry(uuid),
  public.submit_campaign(uuid), public.set_campaign_paused(uuid, boolean), public.end_campaign(uuid),
  public.serve_ads(text, text, text, integer), public.record_ad_event(uuid, text, text, text),
  public.campaign_stats(uuid), public.campaign_daily(uuid, integer),
  public.report_content(text, uuid, text, text), public.user_impact(), public.ai_take_quota(text, integer),
  public.admin_resolve_report(uuid, text, text), public.admin_review_campaign(uuid, boolean, text),
  public.admin_release_credit(uuid, boolean), public.admin_set_setting(text, jsonb),
  public.admin_set_user_status(uuid, text, text), public.admin_overview()
to authenticated;

-- Only the server (service role) runs maintenance. Internal helpers (notify, post_credit, award_*,
-- refund_unspent, log_donation_event, setting_*, owner_of) stay unreachable from the browser.
grant execute on function public.run_maintenance() to service_role;

-- 3) Views and table access for the public member view
grant select on public.public_profiles to anon, authenticated;

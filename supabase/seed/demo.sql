-- OPTIONAL demo data for presentations. Run it in the Supabase SQL editor only if you want it.
--
-- * Every record is flagged is_demo = true and titled "[DEMO]". Nothing is created from the app.
-- * Demo members have no password, so nobody can log in as them.
-- * Demo members and their records are hidden from leaderboards and impact totals unless an admin
--   sets the platform setting demo_visible to true.
-- * Remove everything with supabase/seed/remove_demo.sql.

do $$
declare
  donor uuid := '00000000-0000-4000-8000-0000000000a1';
  farmer uuid := '00000000-0000-4000-8000-0000000000b2';
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at)
  values
    (donor,  'authenticated', 'authenticated', 'demo-donor@example.invalid',  '{"first_name":"Demo","last_name":"Kitchen","primary_role":"donor"}',  now(), now()),
    (farmer, 'authenticated', 'authenticated', 'demo-farmer@example.invalid', '{"first_name":"Demo","last_name":"Farmer","primary_role":"donor"}', now(), now())
  on conflict (id) do nothing;

  update public.profiles set is_demo = true, display_name = '[DEMO] Campus Kitchen', organisation_name = '[DEMO] Campus Kitchen',
    county = 'Kisii', town = 'Kisii' where id = donor;
  update public.profiles set is_demo = true, display_name = '[DEMO] Farmer', county = 'Nyamira', town = 'Nyamira' where id = farmer;

  insert into public.food_donations (donor_id, title, category, description, quantity, quantity_remaining, unit, expires_at,
                                     county, town, lat, lng, dietary, status, is_demo, published_at)
  values
    (donor, '[DEMO] Rice and beans', 'cooked_meals', 'Sample listing for demonstrations.', 12, 12, 'portions', now() + interval '6 hours',
     'Kisii', 'Kisii', -0.68, 34.77, '{Vegetarian}', 'available', true, now()),
    (donor, '[DEMO] Day-old bread', 'bakery', 'Sample listing for demonstrations.', 20, 20, 'pieces', now() + interval '10 hours',
     'Kisii', 'Kisii', -0.68, 34.77, '{}', 'available', true, now());

  insert into public.donation_private (donation_id, pickup_address)
  select id, '[DEMO] No real address' from public.food_donations where donor_id = donor;

  insert into public.farmer_profiles (user_id, farm_name, farmer_name, county, town, description, is_demo)
  values (farmer, '[DEMO] Sample Farm', '[DEMO] Farmer', 'Nyamira', 'Nyamira', 'A demonstration seller profile.', true)
  on conflict (user_id) do nothing;

  insert into public.produce_listings (farmer_id, name, category, description, price, unit, quantity_available, county, town, delivery_options, status, is_demo)
  values
    (farmer, '[DEMO] Sukuma wiki', 'vegetables', 'Sample listing for demonstrations.', 30, 'bunch', 50, 'Nyamira', 'Nyamira', '{collection}', 'active', true),
    (farmer, '[DEMO] Tomatoes', 'vegetables', 'Sample listing for demonstrations.', 120, 'kg', 40, 'Nyamira', 'Nyamira', '{collection,arranged}', 'active', true);
end $$;

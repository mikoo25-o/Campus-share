-- Removes everything created by demo.sql. Safe to run more than once.
-- Deleting the auth users cascades to profiles, donations, reservations, listings, credits and notifications.
delete from auth.users where id in (
  select id from public.profiles where is_demo
);

# CampusShare

Food rescue, a farmer market, sponsored advertising, promotional credits, a leaderboard and AI help, for Kenya.
Next.js 15 (App Router) + TypeScript + Tailwind, Supabase (Auth, Postgres, Storage, Realtime), Gemini on the server.

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill it in (never commit .env.local)
                    # http://localhost:3000
```

Without Supabase keys the site still runs and shows a "database not connected" notice.

## 1. Supabase setup

1. Create a project at supabase.com.
2. **SQL editor:** run the files in `supabase/migrations/` in filename order (core, food, market, ads, platform).
   They create every table, Row Level Security policy, the server functions and the four storage buckets.
3. **Authentication > URL configuration:** set Site URL to your site, and add `https://YOUR-SITE/auth/callback`
   (and `http://localhost:3000/auth/callback`) to Redirect URLs. Email verification and password reset use it.
4. **Project settings > API:** copy the project URL and anon key into `.env.local`.
   The service role key is only for the scheduled job. It must never be exposed to the browser.
5. Make yourself an admin (the app can never grant this): in the SQL editor run
   `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');`

## 2. Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase connection |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Your public address |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Used by `/api/cron/maintenance` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | server only | AI features. Without a key, every AI feature falls back to rule-based answers |
| `CRON_SECRET` | server only | Protects `/api/cron/maintenance` |

Keep secrets in `.env.local` (git-ignored). If a key was ever committed or pasted somewhere public, rotate it.

## 3. Logo, photos and ads

* Logo: put your file at `public/images/logo/campusshare-logo.png`. It appears at the top of every page. Until then a dashed "Logo space" box shows.
* Landing photos: `public/images/hero/`. Add slides in `app/(site)/page.tsx` (`HERO_SLIDES`).
* The rotating banners on Promote & Advertise are **example creatives** (`lib/ad-placeholders.ts`). Live ads come only from approved campaigns.

## 4. Deploy (Vercel)

1. Import the repo, add the environment variables above, deploy.
2. `vercel.json` schedules `/api/cron/maintenance` every 15 minutes. It expires old food and reservations, sends pickup reminders and closes finished campaigns. (Vercel's Hobby plan only allows daily cron: change the schedule or call the URL from any scheduler with `Authorization: Bearer $CRON_SECRET`.)
3. Add your site's address to Supabase Redirect URLs.

## 5. How it works

* **Donations:** draft > published (needs a photo, private pickup details and a future deadline) > reserved > collected. Reservation is decided by the database under a row lock, so two people can never take the same food.
* **Verified collection:** the receiver gets a 6-digit code. The donor types it in when handing over. Five wrong attempts lock it. Credits are awarded only then.
* **Privacy:** the public sees county and town. The exact address, instructions and phone are visible only to the donor and to the person holding the reservation.
* **Credits:** an append-only ledger with idempotent entries, daily caps, and holds for repeated same-pair collections that an admin can release or reverse. Credits have no cash value.
* **Ads:** campaigns are paid with credits, reviewed by an admin, always labelled "Sponsored". Clicks cost credits; impressions are free. Only signed-in viewers are counted, with de-duplication, and the destination link is only released when a click is recorded.
* **Farmer market:** enquiries and replies only. No checkout and no payment is simulated.
* **AI (server-side):** listing help, ad copy, food matching, climate-smart advice (real Open-Meteo forecast), impact summary. Each has a per-user daily limit, validates the model's output, and has a rule-based fallback. Input is passed as data, not instructions.

## 6. Optional demo data

`supabase/seed/demo.sql` adds two clearly labelled "[DEMO]" members with a few listings (no logins possible, hidden from leaderboards and impact totals unless the admin setting `demo_visible` is true). `supabase/seed/remove_demo.sql` deletes all of it. Nothing is seeded by default.

## 7. Tests

```bash
npm run typecheck
npm run build
npm run test:db                                  # 51 database tests on in-memory Postgres
DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db   # real server, adds true parallel reservation tests
```

## 8. What is verified and what is not

Verified: the production build, type-check, no horizontal overflow from 360 to 1440 px, and the whole database layer (RLS, reservation races, credits, ads, moderation, quotas, storage rules, maintenance, demo seed and removal) on real PostgreSQL 16.

Not verified here, because the build environment can't reach those services: live Supabase sign-up, email delivery, image uploads to Storage, real Gemini responses, Open-Meteo, and OpenStreetMap tiles. Test those once with your keys.

Not built: payments (M-Pesa or card; `ad_transactions` is a reserved empty table), social sign-in, "your rank changed" notifications, per-IP abuse limits (add at your host or CDN), Terms and Privacy pages (write them for your organisation and link them from sign-up), push notifications.

## 9. Security notes

* Row Level Security is on for every table. Money, credits, campaign spend, moderation and reservations can only change through database functions.
* Photos are re-encoded in the browser, which strips location data. Maps show county centres, never real addresses.
* Food safety guidance is on the Help page and on every donation. CampusShare does not inspect food.

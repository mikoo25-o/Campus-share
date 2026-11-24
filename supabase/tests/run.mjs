// Database tests for the CampusShare migrations.
//
//   npm run test:db                                   -> in-memory Postgres (PGlite), nothing to install
//   DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
//                                                     -> a real server (needs a superuser). Also runs the
//                                                        true-concurrency reservation test.
//
// The tests create their own throwaway database and never touch an existing one.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

// ---------------------------------------------------------------------------
// Backend: real Postgres (pg) or PGlite
// ---------------------------------------------------------------------------
let backend;
let cleanup = async () => {};

if (process.env.DATABASE_URL) {
  const pg = (await import("pg")).default;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  const name = `cs_test_${Date.now()}`;
  await admin.query(`create database ${name}`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 8 });
  pool.on("error", () => {});
  backend = {
    name: "PostgreSQL (real server)",
    concurrent: true,
    withClient: async (fn) => {
      const c = await pool.connect();
      try { return await fn(c); } finally { c.release(); }
    },
  };
  cleanup = async () => {
    await pool.end();
    await admin.query(`drop database ${name} with (force)`);
    await admin.end();
  };
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  let chain = Promise.resolve();
  backend = {
    name: "PGlite (in-memory Postgres)",
    concurrent: false,
    // PGlite has one connection, so calls take turns.
    withClient: (fn) => {
      const run = chain.then(() => fn({ query: (s, p) => db.query(s, p) }));
      chain = run.catch(() => {});
      return run;
    },
    exec: (sql) => db.exec(sql),
  };
  cleanup = async () => db.close();
}

async function execScript(sql) {
  if (backend.exec) return backend.exec(sql);
  return backend.withClient((c) => c.query(sql));
}

// Run one statement as a signed-in user (uid), as the signed-out role (null), as the server, or as superuser.
async function run(role, uid, sql, params = []) {
  return backend.withClient(async (c) => {
    await c.query("begin");
    try {
      if (role !== "super") await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
      const r = await c.query(sql, params);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  });
}
const as = (uid, sql, params) => run(uid ? "authenticated" : "anon", uid, sql, params);
const server = (sql, params) => run("service_role", null, sql, params);
const sup = (sql, params) => run("super", null, sql, params);
const rows = async (p) => (await p).rows;
const one = async (p) => (await rows(p))[0];

// ---------------------------------------------------------------------------
// Tiny test framework
// ---------------------------------------------------------------------------
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`  ok    ${name}`); }
  catch (e) { results.push({ name, ok: false, e }); console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function eq(actual, expected, msg = "") {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} expected ${b} but got ${a}`);
}
async function fails(promise, re) {
  try { await promise; } catch (e) {
    if (re && !re.test(e.message)) throw new Error(`wrong error: "${e.message}" (wanted ${re})`);
    return;
  }
  throw new Error(`expected an error${re ? ` matching ${re}` : ""} but the call succeeded`);
}

// ---------------------------------------------------------------------------
// Build the database
// ---------------------------------------------------------------------------
console.log(`Backend: ${backend.name}\n`);
await execScript(fs.readFileSync(path.join(here, "supabase-stubs.sql"), "utf8"));
for (const f of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  try { await execScript(fs.readFileSync(path.join(migrationsDir, f), "utf8")); console.log(`applied ${f}`); }
  catch (e) { console.error(`\nMIGRATION FAILED: ${f}\n${e.message}`); await cleanup(); process.exit(2); }
}
console.log("");

async function mkUser(name, meta = {}) {
  const r = await sup("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [`${name}@test.local`, JSON.stringify({ first_name: name, last_name: "Tester", ...meta })]);
  return r.rows[0].id;
}
const alice = await mkUser("Alice", { primary_role: "donor" });
const bob = await mkUser("Bob", { primary_role: "receiver" });
const cara = await mkUser("Cara", { primary_role: "receiver" });
const mallory = await mkUser("Mallory", { primary_role: "receiver" });
const dan = await mkUser("Dan", { primary_role: "donor" });
const eve = await mkUser("Eve", { primary_role: "donor" });
await sup("update public.profiles set is_admin = true where id = $1", [eve]);

async function newDonation(uid, { qty = 5, unit = "kg", title = "Fresh tomatoes", hours = 24, publish = true } = {}) {
  const id = (await one(as(uid, `insert into public.food_donations (donor_id, title, category, quantity, quantity_remaining, unit, expires_at, county, town)
    values ($1, $2, 'fresh_vegetables', $3, $3, $4, now() + ($5 || ' hours')::interval, 'Kisii', 'Kisii Town') returning id`, [uid, title, qty, unit, String(hours)]))).id;
  await as(uid, "insert into public.donation_images (donation_id, storage_path) values ($1, $2)", [id, `${uid}/${id}.jpg`]);
  await as(uid, "insert into public.donation_private (donation_id, pickup_address) values ($1, 'Gate 3, Main Campus')", [id]);
  if (publish) await as(uid, "update public.food_donations set status = 'available' where id = $1", [id]);
  return id;
}
const reserve = async (uid, donation, qty) => (await one(as(uid, "select public.reserve_donation($1, $2) as id", [donation, qty]))).id;
const codeOf = async (uid, rid) => (await one(as(uid, "select code from public.reservation_codes where reservation_id = $1", [rid]))).code;
const balance = async (uid) => Number((await one(sup("select balance from public.credit_accounts where user_id = $1", [uid]))).balance);
const setting = (key, value) => sup("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);

// ===========================================================================
console.log("Schema safety");
await test("every table in public has row level security enabled", async () => {
  const bad = await rows(sup("select tablename from pg_tables where schemaname = 'public' and not rowsecurity"));
  eq(bad, [], "tables without RLS:");
});
await test("browsers cannot call internal functions", async () => {
  await fails(as(alice, "select public.notify($1, 'x', 'x', 'x')", [alice]), /permission denied/);
  await fails(as(alice, "select public.post_credit($1, 1000, 'earn', 'x', null, 'posted', 'x')", [alice]), /permission denied/);
  await fails(as(alice, "select public.award_collection_credits(gen_random_uuid())"), /permission denied/);
  await fails(as(alice, "select public.run_maintenance()"), /permission denied/);
  await fails(as(null, "select public.reserve_donation(gen_random_uuid(), 1)"), /permission denied/);
});
await test("the server role can run maintenance", async () => { await server("select public.run_maintenance()"); });

console.log("\nAccounts and profiles");
await test("sign-up creates profile, credit account, preferences", async () => {
  const p = await one(as(alice, "select primary_role, display_name from public.profiles where id = $1", [alice]));
  eq(p, { primary_role: "donor", display_name: "Alice T." });
  eq((await rows(sup("select 1 from public.credit_accounts where user_id = $1", [alice]))).length, 1);
});
await test("a sign-up cannot ask to be an admin or an unknown role", async () => {
  const sneaky = await mkUser("Sneaky", { primary_role: "admin", is_admin: true, status: "active", is_demo: true });
  const p = await one(sup("select primary_role, is_admin, is_demo from public.profiles where id = $1", [sneaky]));
  eq(p, { primary_role: "donor", is_admin: false, is_demo: false });
});
await test("a user cannot promote themselves, unsuspend themselves, or mark themselves demo", async () => {
  await fails(as(bob, "update public.profiles set is_admin = true where id = $1", [bob]), /protected_field/);
  await fails(as(bob, "update public.profiles set status = 'active', is_demo = true where id = $1", [bob]), /protected_field/);
});
await test("a user can edit their own display name but cannot read other profiles", async () => {
  await as(bob, "update public.profiles set display_name = 'Bob the Receiver' where id = $1", [bob]);
  eq((await rows(as(bob, "select id from public.profiles"))).length, 1);
  const pub = await rows(as(null, "select display_name from public.public_profiles where id = $1", [bob]));
  eq(pub, [{ display_name: "Bob the Receiver" }]);
  await fails(as(null, "select phone from public.public_profiles"), /column "phone" does not exist/);
});

console.log("\nDonations");
let tomatoes;
await test("a new donation always starts as a draft, with remaining forced to the quantity", async () => {
  await fails(as(alice, `insert into public.food_donations (donor_id, title, category, quantity, quantity_remaining, unit, expires_at, county, town, status)
    values ($1, 'Sneaky', 'other', 5, 5, 'kg', now() + interval '1 day', 'Kisii', 'Kisii', 'available')`, [alice]), /new_donations_start_as_draft/);
  const d = await one(as(alice, `insert into public.food_donations (donor_id, title, category, quantity, quantity_remaining, unit, expires_at, county, town)
    values ($1, 'Inflated', 'other', 5, 5, 'kg', now() + interval '1 day', 'Kisii', 'Kisii') returning quantity_remaining, est_kg`, [alice]));
  eq([Number(d.quantity_remaining), Number(d.est_kg)], [5, 5]);
});
await test("publishing needs a photo, pickup details and a future deadline", async () => {
  const id = (await one(as(alice, `insert into public.food_donations (donor_id, title, category, quantity, quantity_remaining, unit, expires_at, county, town)
    values ($1, 'Needs stuff', 'other', 2, 2, 'kg', now() + interval '1 day', 'Kisii', 'Kisii') returning id`, [alice]))).id;
  await fails(as(alice, "update public.food_donations set status = 'available' where id = $1", [id]), /photo_required/);
  await fails(as(alice, "insert into public.donation_images (donation_id, storage_path) values ($1, $2)", [id, `${bob}/x.jpg`]), /row-level security/);
  await as(alice, "insert into public.donation_images (donation_id, storage_path) values ($1, $2)", [id, `${alice}/x.jpg`]);
  await fails(as(alice, "update public.food_donations set status = 'available' where id = $1", [id]), /pickup_details_required/);
  await as(alice, "insert into public.donation_private (donation_id, pickup_address) values ($1, 'Somewhere')", [id]);
  await as(alice, "update public.food_donations set expires_at = now() - interval '1 hour' where id = $1", [id]);
  await fails(as(alice, "update public.food_donations set status = 'available' where id = $1", [id]), /deadline_in_past/);
  await as(alice, "update public.food_donations set expires_at = now() + interval '3 hours' where id = $1", [id]);
  await as(alice, "update public.food_donations set status = 'available' where id = $1", [id]);
});
await test("a donor cannot jump a donation to collected or rewrite remaining stock", async () => {
  tomatoes = await newDonation(alice, { qty: 5 });
  await fails(as(alice, "update public.food_donations set status = 'collected' where id = $1", [tomatoes]), /use_cancel_action/);
  await as(alice, "update public.food_donations set quantity_remaining = 999 where id = $1", [tomatoes]);
  eq(Number((await one(sup("select quantity_remaining from public.food_donations where id = $1", [tomatoes]))).quantity_remaining), 5);
});
await test("the public sees available food but never the exact pickup address", async () => {
  eq((await rows(as(null, "select id from public.food_donations where id = $1", [tomatoes]))).length, 1);
  eq((await rows(as(null, "select * from public.donation_private"))).length, 0);
  eq((await rows(as(bob, "select * from public.donation_private where donation_id = $1", [tomatoes]))).length, 0);
});
await test("a draft is private to its donor", async () => {
  const draft = await newDonation(alice, { title: "Draft only", publish: false });
  eq((await rows(as(bob, "select id from public.food_donations where id = $1", [draft]))).length, 0);
  eq((await rows(as(alice, "select id from public.food_donations where id = $1", [draft]))).length, 1);
});

console.log("\nReservations");
let bobRes, caraRes;
await test("reserving part of a donation reduces what is left", async () => {
  bobRes = await reserve(bob, tomatoes, 3);
  const d = await one(sup("select quantity_remaining, status from public.food_donations where id = $1", [tomatoes]));
  eq([Number(d.quantity_remaining), d.status], [2, "available"]);
});
await test("the same food cannot be reserved twice", async () => {
  await fails(reserve(cara, tomatoes, 3), /invalid_quantity/);
  caraRes = await reserve(cara, tomatoes, 2);
  const d = await one(sup("select quantity_remaining, status from public.food_donations where id = $1", [tomatoes]));
  eq([Number(d.quantity_remaining), d.status], [0, "reserved"]);
  await fails(reserve(mallory, tomatoes, 1), /donation_unavailable/);
});
await test("donors cannot reserve their own food", async () => {
  const mine = await newDonation(alice, { title: "Mine" });
  await fails(reserve(alice, mine, 1), /own_donation/);
});
await test("only the receiver sees their handover code and the exact address", async () => {
  eq((await rows(as(alice, "select code from public.reservation_codes"))).length, 0);
  eq((await rows(as(cara, "select code from public.reservation_codes where reservation_id = $1", [bobRes]))).length, 0);
  eq((await codeOf(bob, bobRes)).length, 6);
  eq((await rows(as(bob, "select pickup_address from public.donation_private where donation_id = $1", [tomatoes]))).length, 1);
  eq((await rows(as(mallory, "select pickup_address from public.donation_private where donation_id = $1", [tomatoes]))).length, 0);
});
await test("both sides are notified when food is reserved", async () => {
  eq((await rows(as(alice, "select 1 from public.notifications where type = 'donation_reserved'"))).length >= 2, true);
  eq((await rows(as(bob, "select 1 from public.notifications where type = 'reservation_confirmed'"))).length >= 1, true);
});
await test("cancelling a reservation puts the food back, and only the parties can cancel", async () => {
  await fails(as(mallory, "select public.cancel_reservation($1)", [caraRes]), /not_allowed/);
  await as(cara, "select public.cancel_reservation($1)", [caraRes]);
  const d = await one(sup("select quantity_remaining, status from public.food_donations where id = $1", [tomatoes]));
  eq([Number(d.quantity_remaining), d.status], [2, "available"]);
  await fails(as(cara, "select public.cancel_reservation($1)", [caraRes]), /not_cancellable/);
});
await test("a receiver cannot hoard: active reservations are limited", async () => {
  await setting("max_active_reservations", 1);
  const x = await newDonation(alice, { title: "Extra" });
  await fails(reserve(bob, x, 1), /too_many_reservations/);
  await setting("max_active_reservations", 5);
});
await test("CONCURRENCY: three people grabbing the last unit at once, exactly one wins", async () => {
  const last = await newDonation(dan, { qty: 1, title: "Last loaf" });
  const attempts = await Promise.allSettled([reserve(bob, last, 1), reserve(cara, last, 1), reserve(mallory, last, 1)]);
  const won = attempts.filter((a) => a.status === "fulfilled").length;
  eq(won, 1, `winners (${backend.concurrent ? "parallel" : "sequential"} run):`);
  const d = await one(sup("select quantity_remaining, status from public.food_donations where id = $1", [last]));
  eq([Number(d.quantity_remaining), d.status], [0, "reserved"]);
  eq(Number((await one(sup("select count(*) as n from public.food_reservations where donation_id = $1 and status = 'reserved'", [last]))).n), 1);
  // And hammer a bigger pile: 20 requests for 1 unit each against 5 units
  const pile = await newDonation(dan, { qty: 5, title: "Pile" });
  await setting("max_active_reservations", 50);
  const many = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => reserve([bob, cara, mallory][i % 3], pile, 1)));
  eq(many.filter((a) => a.status === "fulfilled").length, 5, "pile winners:");
  eq(Number((await one(sup("select quantity_remaining from public.food_donations where id = $1", [pile]))).quantity_remaining), 0);
  await setting("max_active_reservations", 5);
});

console.log("\nCollection, credits and fraud checks");
await test("only the donor can confirm, and a wrong code is refused and counted", async () => {
  await fails(as(bob, "select public.confirm_collection($1, '000000')", [bobRes]), /not_allowed/);
  const wrong = (await codeOf(bob, bobRes)) === "123456" ? "654321" : "123456";
  const r = (await one(as(alice, "select public.confirm_collection($1, $2) as r", [bobRes, wrong]))).r;
  eq([r.ok, r.reason, r.attempts_left], [false, "wrong_code", 4]);
  eq(await balance(alice), 0);
});
await test("five wrong codes lock the reservation, even for the right code", async () => {
  const wrong = (await codeOf(bob, bobRes)) === "123456" ? "654321" : "123456";
  for (let i = 0; i < 4; i++) await as(alice, "select public.confirm_collection($1, $2)", [bobRes, wrong]);
  const locked = (await one(as(alice, "select public.confirm_collection($1, $2) as r", [bobRes, await codeOf(bob, bobRes)]))).r;
  eq([locked.ok, locked.reason], [false, "locked"]);
  // unlock for the rest of the tests
  await sup("update public.food_reservations set code_attempts = 0 where id = $1", [bobRes]);
});
await test("a verified collection awards credits once, and only once", async () => {
  const ok = (await one(as(alice, "select public.confirm_collection($1, $2) as r", [bobRes, await codeOf(bob, bobRes)]))).r;
  eq(ok.ok, true);
  eq(await balance(alice), 30, "3 kg x 10 credits:");
  await fails(as(alice, "select public.confirm_collection($1, '000000')", [bobRes]), /not_collectable/);
  await sup("select public.award_collection_credits($1)", [bobRes]);
  eq(await balance(alice), 30, "balance after a replayed award:");
  eq(Number((await one(sup("select count(*) as n from public.credit_ledger where source_id = $1", [bobRes]))).n), 1);
});
await test("credit tables cannot be written from a browser", async () => {
  await fails(as(alice, "insert into public.credit_ledger (user_id, amount, entry_type) values ($1, 9999, 'earn')", [alice]), /row-level security/);
  await as(alice, "update public.credit_accounts set balance = 99999 where user_id = $1", [alice]);
  eq(await balance(alice), 30);
  await fails(as(alice, "update public.credit_ledger set amount = 9999"), /./).catch(() => {});
  eq(Number((await one(sup("select max(amount) as m from public.credit_ledger where user_id = $1", [alice]))).m), 30);
});
await test("a donor cannot read another user's credit history", async () => {
  eq((await rows(as(bob, "select * from public.credit_ledger"))).length, 0);
});
await test("repeat collections between the same two people are held for review, then released by an admin", async () => {
  const before = await balance(dan);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const d = await newDonation(dan, { qty: 1, title: `Loaf ${i}` });
    const r = await reserve(mallory, d, 1);
    await as(dan, "select public.confirm_collection($1, $2)", [r, await codeOf(mallory, r)]);
    ids.push(r);
  }
  eq(await balance(dan) - before, 20, "only the first two count:");
  const held = await one(sup("select id, status, amount from public.credit_ledger where source_id = $1", [ids[2]]));
  eq([held.status, held.amount], ["held", 10]);
  await fails(as(dan, "select public.admin_release_credit($1, true)", [held.id]), /not_allowed/);
  await as(eve, "select public.admin_release_credit($1, true)", [held.id]);
  eq(await balance(dan) - before, 30);
  await fails(as(eve, "select public.admin_release_credit($1, true)", [held.id]), /not_held/);
});
await test("the daily credit cap is enforced", async () => {
  await setting("daily_credit_cap", 5);
  const before = await balance(eve);
  const d = await newDonation(eve, { qty: 2, title: "Capped" });
  const r = await reserve(cara, d, 2);
  await as(eve, "select public.confirm_collection($1, $2)", [r, await codeOf(cara, r)]);
  eq(await balance(eve) - before, 5, "20 credits capped to 5:");
  await setting("daily_credit_cap", 300);
});
await test("demo donors never earn real credits", async () => {
  const demo = await mkUser("Demo", { primary_role: "donor" });
  await sup("update public.profiles set is_demo = true where id = $1", [demo]);
  const d = await newDonation(demo, { qty: 2, title: "Demo food" });
  const r = await reserve(bob, d, 2);
  await as(demo, "select public.confirm_collection($1, $2)", [r, await codeOf(bob, r)]);
  eq(await balance(demo), 0);
});

console.log("\nFarmer market");
let listing;
await test("creating a farmer profile flags the account as a farmer", async () => {
  await as(dan, "insert into public.farmer_profiles (user_id, farmer_name, farm_name, county) values ($1, 'Dan K', 'Dan Farm', 'Kisii')", [dan]);
  eq((await one(sup("select is_farmer from public.profiles where id = $1", [dan]))).is_farmer, true);
});
await test("farmers manage their own listings; sold out is automatic; removal is for moderators", async () => {
  listing = (await one(as(dan, "insert into public.produce_listings (farmer_id, name, category, price, unit, quantity_available, county) values ($1, 'Kale', 'vegetables', 40, 'bunch', 10, 'Kisii') returning id", [dan]))).id;
  await fails(as(mallory, "insert into public.produce_listings (farmer_id, name, category, price, unit, quantity_available, county) values ($1, 'Fake', 'fruits', 1, 'kg', 1, 'Kisii')", [dan]), /row-level security/);
  await as(dan, "update public.produce_listings set quantity_available = 0 where id = $1", [listing]);
  eq((await one(as(null, "select status from public.produce_listings where id = $1", [listing]))).status, "sold_out");
  await as(dan, "update public.produce_listings set quantity_available = 10 where id = $1", [listing]);
  eq((await one(as(null, "select status from public.produce_listings where id = $1", [listing]))).status, "active");
  await fails(as(dan, "update public.produce_listings set status = 'removed' where id = $1", [listing]), /protected_field/);
});
await test("a paused or draft listing is not public", async () => {
  const hidden = (await one(as(dan, "insert into public.produce_listings (farmer_id, name, category, price, unit, quantity_available, county, status) values ($1, 'Hidden maize', 'grains', 1, 'kg', 1, 'Kisii', 'paused') returning id", [dan]))).id;
  eq((await rows(as(bob, "select 1 from public.produce_listings where id = $1", [hidden]))).length, 0);
  eq((await rows(as(dan, "select 1 from public.produce_listings where id = $1", [hidden]))).length, 1);
});
await test("enquiries: buyers ask, the farmer is notified, replies reach the buyer, limits apply", async () => {
  const q = (await one(as(bob, "select public.send_enquiry($1, 'Is this organic and can I collect today?', 3) as id", [listing]))).id;
  eq((await rows(as(dan, "select 1 from public.notifications where type = 'enquiry_new'"))).length, 1);
  await fails(as(dan, "select public.send_enquiry($1, 'Asking myself', 1)", [listing]), /own_listing/);
  await fails(as(mallory, "select public.reply_enquiry($1, 'Not mine')", [q]), /not_allowed/);
  eq((await rows(as(mallory, "select 1 from public.product_enquiries"))).length, 0);
  await as(dan, "select public.reply_enquiry($1, 'Yes, come after 3pm')", [q]);
  eq((await one(as(bob, "select status, reply from public.product_enquiries where id = $1", [q]))), { status: "replied", reply: "Yes, come after 3pm" });
  await setting("enquiries_per_day", 1);
  await fails(as(bob, "select public.send_enquiry($1, 'Another question please', 1)", [listing]), /rate_limited/);
  await setting("enquiries_per_day", 10);
});
await test("favourites are private to each user", async () => {
  await as(bob, "insert into public.favourites (user_id, listing_id) values ($1, $2)", [bob, listing]);
  eq((await rows(as(cara, "select 1 from public.favourites"))).length, 0);
  await fails(as(cara, "insert into public.favourites (user_id, listing_id) values ($1, $2)", [bob, listing]), /row-level security/);
});

console.log("\nAdvertising");
let camp;
await test("advertisers create drafts but cannot set status, spend or payment from the browser", async () => {
  await as(dan, "insert into public.advertiser_profiles (user_id, business_name, business_type) values ($1, 'Dan Agro', 'agri_supplier')", [dan]);
  await fails(as(dan, `insert into public.ad_campaigns (owner_id, name, campaign_type, headline, destination_url, start_date, end_date, budget_credits, status)
    values ($1, 'Sneaky', 'agri_supplier', 'Great seeds today', 'https://example.com', current_date, current_date + 7, 100, 'approved')`, [dan]), /protected_field/);
  await fails(as(dan, `insert into public.ad_campaigns (owner_id, name, campaign_type, headline, destination_url, start_date, end_date, budget_credits)
    values ($1, 'Bad link', 'agri_supplier', 'Great seeds today', 'javascript:alert(1)', current_date, current_date + 7, 100)`, [dan]), /check constraint/);
  camp = (await one(as(dan, `insert into public.ad_campaigns (owner_id, name, campaign_type, headline, destination_url, start_date, end_date, budget_credits)
    values ($1, 'Seeds season', 'agri_supplier', 'Quality seeds for the season', 'https://example.com/seeds', current_date, current_date + 7, 100) returning id`, [dan]))).id;
  await fails(as(dan, "update public.ad_campaigns set status = 'approved', spent_credits = 0, payment_status = 'paid' where id = $1", [camp]), /protected_field/);
});
await test("submitting needs real credits, debits exactly once, and cannot be repeated", async () => {
  await sup("update public.credit_accounts set balance = 0 where user_id = $1", [dan]);
  await fails(as(dan, "select public.submit_campaign($1)", [camp]), /insufficient_credits/);
  await sup("update public.credit_accounts set balance = 150 where user_id = $1", [dan]);
  await fails(as(bob, "select public.submit_campaign($1)", [camp]), /not_allowed/);
  await as(dan, "select public.submit_campaign($1)", [camp]);
  eq(await balance(dan), 50, "150 - 100:");
  await fails(as(dan, "select public.submit_campaign($1)", [camp]), /not_submittable/);
  eq(await balance(dan), 50, "no second debit:");
  await as(dan, "update public.ad_campaigns set budget_credits = 1 where id = $1", [camp]);
  eq((await one(sup("select budget_credits from public.ad_campaigns where id = $1", [camp]))).budget_credits, 100, "budget after a locked edit:");
});
await test("nobody sees an ad before it is approved, and only admins can approve", async () => {
  eq((await rows(as(bob, "select 1 from public.serve_ads('dashboard', 'Kisii', null, 3)"))).length, 0);
  eq((await rows(as(bob, "select 1 from public.ad_campaigns where id = $1", [camp]))).length, 0);
  await fails(as(bob, "select public.admin_review_campaign($1, true, null)", [camp]), /not_allowed/);
  await fails(as(dan, "select public.admin_review_campaign($1, true, null)", [camp]), /not_allowed/);
  await as(eve, "select public.admin_review_campaign($1, true, null)", [camp]);
  eq((await rows(as(bob, "select 1 from public.serve_ads('dashboard', 'Kisii', null, 3)"))).length, 1);
  await fails(as(null, "select 1 from public.serve_ads('dashboard', 'Kisii', null, 3)"), /permission denied/);
  eq((await rows(as(bob, "select 1 from public.serve_ads('dashboard', 'Nairobi', null, 3)"))).length, 1, "untargeted counties still match:");
});
await test("impressions and clicks are counted once per viewer, and owners never count", async () => {
  const ev = async (uid, kind) => (await one(as(uid, "select public.record_ad_event($1, $2, 'dashboard', 'sess') as r", [camp, kind]))).r;
  eq((await ev(bob, "click")).reason, "no_impression");
  eq((await ev(bob, "impression")).counted, true);
  eq((await ev(bob, "impression")).reason, "duplicate");
  const click = await ev(bob, "click");
  eq([click.counted, click.url, click.charged], [true, "https://example.com/seeds", 5]);
  eq((await ev(bob, "click")).reason, "duplicate");
  eq((await ev(dan, "impression")).reason, "owner");
  const stats = (await one(as(dan, "select public.campaign_stats($1) as s", [camp]))).s;
  eq([stats.impressions, stats.clicks, stats.ctr, stats.spent], [1, 1, 100, 5]);
  await fails(as(bob, "select public.campaign_stats($1)", [camp]), /not_allowed/);
  await fails(as(bob, "insert into public.ad_events (campaign_id, kind, placement, viewer_id, session_key) values ($1, 'click', 'x', $2, 'x')", [camp, bob]), /row-level security/);
  eq((await rows(as(bob, "select 1 from public.ad_events"))).length, 0);
});
await test("when the budget runs out the campaign ends and unspent credits come back", async () => {
  await setting("cpc_credits", 45);
  const before = await balance(dan);
  const c2 = (await one(as(dan, `insert into public.ad_campaigns (owner_id, name, campaign_type, headline, destination_url, start_date, end_date, budget_credits)
    values ($1, 'Small', 'agri_supplier', 'A tiny test campaign', 'https://example.com', current_date, current_date + 3, 50) returning id`, [dan]))).id;
  await as(dan, "select public.submit_campaign($1)", [c2]);
  await as(eve, "select public.admin_review_campaign($1, true, null)", [c2]);
  await as(cara, "select public.record_ad_event($1, 'impression', 'dashboard', 's')", [c2]);
  const r = (await one(as(cara, "select public.record_ad_event($1, 'click', 'dashboard', 's') as r", [c2]))).r;
  eq(r.charged, 45);
  const c = await one(sup("select status, spent_credits, refunded_credits from public.ad_campaigns where id = $1", [c2]));
  eq([c.status, c.spent_credits, c.refunded_credits], ["ended", 45, 5]);
  eq(await balance(dan) - before, -45, "net cost is only what was spent:");
  await setting("cpc_credits", 5);
});
await test("a rejected campaign returns the credits, and resubmitting debits again", async () => {
  const before = await balance(dan);
  const c3 = (await one(as(dan, `insert into public.ad_campaigns (owner_id, name, campaign_type, headline, destination_url, start_date, end_date, budget_credits)
    values ($1, 'To reject', 'agri_supplier', 'This will be rejected', 'https://example.com', current_date, current_date + 3, 50) returning id`, [dan]))).id;
  await sup("update public.credit_accounts set balance = balance + 60 where user_id = $1", [dan]);
  await as(dan, "select public.submit_campaign($1)", [c3]);
  await fails(as(eve, "select public.admin_review_campaign($1, false, '')", [c3]), /reason_required/);
  await as(eve, "select public.admin_review_campaign($1, false, 'Claims are not supported')", [c3]);
  eq(await balance(dan), before + 60, "full refund:");
  await as(dan, "update public.ad_campaigns set headline = 'Now with honest claims' where id = $1", [c3]);
  await as(dan, "select public.submit_campaign($1)", [c3]);
  eq(await balance(dan), before + 10, "debited again:");
});

console.log("\nNotifications");
await test("notifications are private, read-only for the owner, and can be marked read", async () => {
  const mine = await rows(as(bob, "select id from public.notifications where read_at is null"));
  eq(mine.length > 0, true);
  eq((await rows(as(bob, "select 1 from public.notifications where user_id <> $1", [bob]))).length, 0);
  await fails(as(bob, "insert into public.notifications (user_id, type, title) values ($1, 'x', 'forged')", [bob]), /row-level security/);
  await as(bob, "update public.notifications set title = 'edited' where user_id = $1", [bob]);
  eq((await rows(as(bob, "select 1 from public.notifications where title = 'edited'"))).length, 0, "titles cannot be edited:");
  await as(cara, "select public.mark_notifications_read($1)", [[mine[0].id]]);
  eq((await rows(as(bob, "select 1 from public.notifications where id = $1 and read_at is null", [mine[0].id]))).length, 1, "others cannot mark mine read:");
  await as(bob, "select public.mark_all_notifications_read()");
  eq((await rows(as(bob, "select 1 from public.notifications where read_at is null"))).length, 0);
});
await test("a user can mute a type, but security alerts always arrive", async () => {
  await as(cara, "update public.notification_preferences set muted_types = '{enquiry_new,security_alert}' where user_id = $1", [cara]);
  await sup("select public.notify($1, 'enquiry_new', 'muted', 'x')", [cara]);
  await sup("select public.notify($1, 'security_alert', 'new login', 'x')", [cara]);
  eq((await rows(as(cara, "select 1 from public.notifications where title = 'muted'"))).length, 0);
  eq((await rows(as(cara, "select 1 from public.notifications where title = 'new login'"))).length, 1);
});

console.log("\nReports and moderation");
await test("reports are rate limited, deduplicated, private, and resolved only by admins", async () => {
  const target = await newDonation(mallory, { title: "Recalled rice" });
  const rid = (await one(as(bob, "select public.report_content('donation', $1, 'unsafe_food', 'Smells off') as id", [target]))).id;
  await fails(as(bob, "select public.report_content('donation', $1, 'unsafe_food', 'again')", [target]), /already_reported/);
  eq((await rows(as(cara, "select 1 from public.reports"))).length, 0);
  await fails(as(bob, "select public.admin_resolve_report($1, 'remove_content', 'x')", [rid]), /not_allowed/);
  await as(eve, "select public.admin_resolve_report($1, 'remove_content', 'Unsafe food')", [rid]);
  eq((await one(sup("select status from public.food_donations where id = $1", [target]))).status, "cancelled");
  eq((await rows(as(mallory, "select 1 from public.notifications where type = 'content_removed'"))).length, 1);
  eq(Number((await one(sup("select count(*) as n from public.moderation_events where action = 'report_remove_content'"))).n), 1);
});
await test("suspending a user blocks them from acting, and admins cannot be suspended by a report", async () => {
  const t2 = await newDonation(mallory, { title: "More dodgy rice" });
  const rid = (await one(as(bob, "select public.report_content('donation', $1, 'misleading', null) as id", [t2]))).id;
  await as(eve, "select public.admin_resolve_report($1, 'suspend_user', 'Repeat offender')", [rid]);
  eq((await one(sup("select status from public.profiles where id = $1", [mallory]))).status, "suspended");
  await fails(as(mallory, `insert into public.food_donations (donor_id, title, category, quantity, quantity_remaining, unit, expires_at, county, town)
    values ($1, 'Blocked', 'other', 1, 1, 'kg', now() + interval '1 day', 'Kisii', 'Kisii')`, [mallory]), /row-level security/);
  const open = await newDonation(dan, { title: "Open food" });
  await fails(reserve(mallory, open, 1), /account_suspended/);
  await fails(as(mallory, "update public.profiles set status = 'active' where id = $1", [mallory]), /protected_field/);
  await as(eve, "select public.admin_set_user_status($1, 'active', 'Appeal accepted')", [mallory]);
  await fails(as(eve, "select public.admin_set_user_status($1, 'suspended', 'x')", [eve]), /not_found/);
});
await test("settings: anyone can read, only admins can change, unknown keys are refused", async () => {
  eq((await rows(as(null, "select value from public.platform_settings where key = 'cpc_credits'"))).length, 1);
  await fails(as(bob, "select public.admin_set_setting('cpc_credits', '1')"), /not_allowed/);
  await as(bob, "update public.platform_settings set value = '1' where key = 'cpc_credits'");
  eq(Number((await one(sup("select value from public.platform_settings where key = 'cpc_credits'"))).value), 5, "direct update ignored:");
  await as(eve, "select public.admin_set_setting('cpc_credits', '6')");
  await as(eve, "select public.admin_set_setting('cpc_credits', '5')");
  await fails(as(eve, "select public.admin_set_setting('nonsense', '1')"), /unknown_setting/);
});
await test("admin overview is admin-only", async () => {
  await fails(as(bob, "select public.admin_overview()"), /not_allowed/);
  eq(typeof (await one(as(eve, "select public.admin_overview() as o"))).o.members, "number");
});

console.log("\nLeaderboard, impact and search");
await test("the leaderboard ranks verified activity and hides opt-outs", async () => {
  const board = await rows(as(bob, "select * from public.leaderboard('donors', 'all', 10)"));
  eq(board[0].display_name.startsWith("Dan") || board[0].display_name.startsWith("Alice"), true);
  eq(board.every((r) => Number(r.collections) > 0), true);
  await sup("update public.profiles set show_on_leaderboard = false where id = $1", [dan]);
  eq((await rows(as(bob, "select * from public.leaderboard('donors', 'all', 10)"))).some((r) => r.display_name.startsWith("Dan")), false);
  await sup("update public.profiles set show_on_leaderboard = true where id = $1", [dan]);
  const credits = await rows(as(alice, "select * from public.leaderboard('credits', 'all', 10)"));
  eq(Number(credits.find((r) => r.is_me).credits), 30);
  const saved = await rows(as(alice, "select * from public.leaderboard('food_saved', 'week', 10)"));
  eq(Number(saved.find((r) => r.is_me).kg), 3);
  await fails(as(bob, "select * from public.leaderboard('hackers', 'all', 10)"), /invalid_kind/);
});
await test("demo records stay off public totals unless demo mode is switched on", async () => {
  const before = (await one(as(null, "select public.platform_impact() as i"))).i;
  await setting("demo_visible", true);
  const after = (await one(as(null, "select public.platform_impact() as i"))).i;
  await setting("demo_visible", false);
  eq(Number(after.kg) > Number(before.kg), true, "demo kg appears only when enabled:");
  eq(Number(before.kg) >= 3, true);
  eq(Number(before.co2e_kg_estimate), Number(before.kg) * 2.5);
});
await test("search finds public items only and treats % and _ literally", async () => {
  eq((await rows(as(null, "select * from public.search_all('kale', null, 10)"))).some((r) => r.kind === "produce"), true);
  eq((await rows(as(null, "select * from public.search_all('Recalled rice', null, 10)"))).length, 0, "cancelled donations are not searchable:");
  eq((await rows(as(null, "select * from public.search_all('Hidden maize', null, 10)"))).length, 0, "paused listings are not searchable:");
  eq((await rows(as(null, "select * from public.search_all('%%', null, 10)"))).length, 0, "wildcards are escaped:");
  eq((await rows(as(null, "select * from public.search_all('k', null, 10)"))).length, 0, "too short:");
});

console.log("\nMaintenance, quota and storage");
await test("maintenance expires overdue food, sends one reminder, and closes finished campaigns", async () => {
  const soon = await newDonation(alice, { qty: 2, title: "Soon food", hours: 1 });
  const r1 = await reserve(cara, soon, 1);
  await server("select public.run_maintenance()");
  await server("select public.run_maintenance()");
  const rem = await rows(as(cara, "select title, body from public.notifications where type = 'pickup_reminder'"));
  eq(rem.length, 1, `exactly one reminder (got: ${JSON.stringify(rem.map((x) => x.body))}):`);
  await sup("update public.food_donations set expires_at = now() - interval '1 minute' where id = $1", [soon]);
  await server("select public.run_maintenance()");
  eq((await one(sup("select status from public.food_donations where id = $1", [soon]))).status, "expired");
  eq((await one(sup("select status from public.food_reservations where id = $1", [r1]))).status, "expired");
  await sup("update public.ad_campaigns set end_date = current_date - 1, start_date = current_date - 5 where id = $1", [camp]);
  const before = await balance(dan);
  await server("select public.run_maintenance()");
  eq((await one(sup("select status from public.ad_campaigns where id = $1", [camp]))).status, "ended");
  eq(await balance(dan) - before, 95, "100 budget - 5 spent comes back:");
  const summaryFor = async () => (await rows(as(dan, "select 1 from public.notifications where type = 'campaign_summary' and link = $1", [`/promote/${camp}`]))).length;
  eq(await summaryFor(), 1);
  await server("select public.run_maintenance()");
  eq(await summaryFor(), 1, "summary sent once:");
});
await test("the AI quota counts calls per user per feature and refuses past the limit", async () => {
  const take = async () => (await one(as(bob, "select public.ai_take_quota('match', 2) as ok"))).ok;
  eq([await take(), await take(), await take()], [true, true, false]);
  eq((await one(as(cara, "select public.ai_take_quota('match', 2) as ok"))).ok, true, "other users unaffected:");
  await fails(as(null, "select public.ai_take_quota('match', 2) as ok"), /permission denied/);
});
await test("storage: users can only write inside their own folder", async () => {
  await as(alice, "insert into storage.objects (bucket_id, name, owner) values ('donation-images', $1, $2)", [`${alice}/a.jpg`, alice]);
  await fails(as(alice, "insert into storage.objects (bucket_id, name, owner) values ('donation-images', $1, $2)", [`${bob}/a.jpg`, alice]), /row-level security/);
  await fails(as(null, "insert into storage.objects (bucket_id, name) values ('donation-images', 'x/a.jpg')"), /permission denied|row-level security/);
  eq((await rows(sup("select id, file_size_limit, public from storage.buckets order by id"))).length, 4);
});

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${backend.concurrent ? " (including parallel reservations)" : " (reservations ran one after another on this backend)"}`);
await cleanup();
process.exit(failed.length ? 1 : 0);

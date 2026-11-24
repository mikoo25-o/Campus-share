"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, ChipGroup, Notice, PageHeader, SelectInput, TextInput } from "@/components/ui";
import { COUNTIES, DIETARY_OPTIONS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";

const MUTABLE = [
  { value: "enquiry_new", label: "New enquiries" },
  { value: "enquiry_reply", label: "Enquiry replies" },
  { value: "donation_reminder", label: "Pickup reminders" },
  { value: "campaign_summary", label: "Campaign summaries" },
];

export default function ProfilePage() {
  const { supabase, user, profile, refreshProfile, signOut } = useAuth();
  const [f, setF] = useState({ display_name: "", first_name: "", last_name: "", phone: "", organisation_name: "", county: "", town: "", primary_role: "donor", show_on_leaderboard: true });
  const [dietary, setDietary] = useState<string[]>([]);
  const [radius, setRadius] = useState("10");
  const [ai, setAi] = useState(true);
  const [muted, setMuted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!profile || !supabase || !user) return;
    setF({ display_name: profile.display_name, first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone ?? "", organisation_name: profile.organisation_name ?? "", county: profile.county ?? "", town: profile.town ?? "", primary_role: profile.primary_role, show_on_leaderboard: profile.show_on_leaderboard });
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setDietary(data.dietary); setRadius(String(data.radius_km)); setAi(data.ai_personalisation); }
    });
    supabase.from("notification_preferences").select("muted_types").eq("user_id", user.id).maybeSingle().then(({ data }) => setMuted(data?.muted_types ?? []));
  }, [profile, supabase, user]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    if (f.display_name.trim().length < 2) return setMsg({ tone: "error", text: "Display name must be at least 2 characters." });
    setBusy(true);
    setMsg(null);
    const a = await supabase.from("profiles").update({
      display_name: f.display_name.trim(), first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      phone: f.phone.trim() || null, organisation_name: f.organisation_name.trim() || null,
      county: f.county || null, town: f.town.trim() || null, primary_role: f.primary_role, show_on_leaderboard: f.show_on_leaderboard,
    }).eq("id", user.id);
    const b = await supabase.from("user_preferences").upsert({ user_id: user.id, dietary, radius_km: Math.min(200, Math.max(1, Number(radius) || 10)), ai_personalisation: ai, county: f.county || null, town: f.town.trim() || null });
    const c = await supabase.from("notification_preferences").upsert({ user_id: user.id, muted_types: muted });
    setBusy(false);
    const err = a.error ?? b.error ?? c.error;
    if (err) return setMsg({ tone: "error", text: friendlyError(err) });
    await refreshProfile();
    setMsg({ tone: "success", text: "Saved." });
  }

  const labels = MUTABLE.map((m) => m.label);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile & settings" subtitle={user?.email ?? undefined} />
      <form onSubmit={save} noValidate className="space-y-6">
        <Card className="space-y-5">
          <h2 className="text-lg font-bold">About you</h2>
          <TextInput label="Display name" required maxLength={40} value={f.display_name} onChange={(e) => set("display_name", e.target.value)} hint="Shown to other members and on the leaderboard." />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput label="First name" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
            <TextInput label="Last name" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </div>
          <TextInput label="Phone (private)" type="tel" maxLength={25} value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          <TextInput label="Organisation (optional)" maxLength={80} value={f.organisation_name} onChange={(e) => set("organisation_name", e.target.value)} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput label="County" value={f.county} onChange={(e) => set("county", e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a county" />
            <TextInput label="Town or area" maxLength={60} value={f.town} onChange={(e) => set("town", e.target.value)} />
          </div>
          <SelectInput label="I mostly use CampusShare to" value={f.primary_role} onChange={(e) => set("primary_role", e.target.value)} options={[{ value: "donor", label: "Share food" }, { value: "receiver", label: "Collect food" }]} />
        </Card>

        <Card className="space-y-5">
          <h2 className="text-lg font-bold">Preferences</h2>
          <ChipGroup label="Dietary needs (used for food matching)" options={DIETARY_OPTIONS} value={dietary} onChange={setDietary} />
          <TextInput label="Search radius (km)" type="number" min="1" max="200" value={radius} onChange={(e) => setRadius(e.target.value)} />
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-brand-forest" checked={ai} onChange={(e) => setAi(e.target.checked)} /><span>Use my county and dietary preferences to personalise AI recommendations.</span></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-brand-forest" checked={f.show_on_leaderboard} onChange={(e) => set("show_on_leaderboard", e.target.checked)} /><span>Show me on the public leaderboard.</span></label>
          <ChipGroup label="Notifications I want to turn off" options={labels} value={muted.map((v) => MUTABLE.find((m) => m.value === v)?.label ?? v)} onChange={(ls) => setMuted(ls.map((l) => MUTABLE.find((m) => m.label === l)?.value ?? l))} />
          <p className="text-xs text-brand-muted">Security and safety notices can&apos;t be turned off.</p>
        </Card>

        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Button type="submit" loading={busy} className="w-full">Save changes</Button>
      </form>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Your tools</h2>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link className="underline" href="/farmer-market/profile">{profile?.is_farmer ? "Farm profile" : "Become a seller"}</Link>
          <Link className="underline" href="/promote/profile">{profile?.is_advertiser ? "Business profile" : "Start advertising"}</Link>
          <Link className="underline" href="/credits">Credits</Link>
        </div>
        <Button variant="secondary" onClick={() => void signOut()}>Log out</Button>
      </Card>
    </div>
  );
}

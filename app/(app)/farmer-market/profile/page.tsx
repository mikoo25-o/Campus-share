"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, ChipGroup, Notice, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";
import { COUNTIES, PRODUCE_CATEGORIES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import type { FarmerProfile } from "@/lib/types";

export default function FarmerProfilePage() {
  const { supabase, user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [exists, setExists] = useState(false);
  const [f, setF] = useState({ farm_name: "", farmer_name: "", county: "", town: "", description: "", contact_note: "", categories: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from("farmer_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const p = data as FarmerProfile | null;
      if (p) {
        setExists(true);
        setF({ farm_name: p.farm_name, farmer_name: p.farmer_name, county: p.county, town: p.town ?? "", description: p.description ?? "", contact_note: p.contact_note ?? "", categories: p.categories });
      } else if (profile) {
        setF((x) => ({ ...x, farmer_name: profile.display_name, county: profile.county ?? "", town: profile.town ?? "" }));
      }
    });
  }, [supabase, user, profile]);

  const catLabels = PRODUCE_CATEGORIES.map((c) => c.label);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    if (f.farm_name.trim().length < 2 || f.farmer_name.trim().length < 2 || !f.county) return setMsg({ tone: "error", text: "Farm name, your name and county are required." });
    setBusy(true);
    setMsg(null);
    const row = {
      user_id: user.id,
      farm_name: f.farm_name.trim(),
      farmer_name: f.farmer_name.trim(),
      county: f.county,
      town: f.town.trim() || null,
      description: f.description.trim() || null,
      contact_note: f.contact_note.trim() || null,
      categories: f.categories,
    };
    const { error } = exists ? await supabase.from("farmer_profiles").update(row).eq("user_id", user.id) : await supabase.from("farmer_profiles").insert(row);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: friendlyError(error) });
    await refreshProfile();
    if (!exists) router.push("/farmer-market/new");
    else setMsg({ tone: "success", text: "Saved." });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title={exists ? "Farm profile" : "Become a seller"} subtitle="Buyers see this on your listings. Don't add your exact address." />
      <Card>
        <form onSubmit={save} className="space-y-5" noValidate>
          <TextInput label="Farm or business name" required maxLength={80} value={f.farm_name} onChange={(e) => set("farm_name", e.target.value)} />
          <TextInput label="Your name" required maxLength={80} value={f.farmer_name} onChange={(e) => set("farmer_name", e.target.value)} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput label="County" required value={f.county} onChange={(e) => set("county", e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a county" />
            <TextInput label="Town or area" maxLength={60} value={f.town} onChange={(e) => set("town", e.target.value)} />
          </div>
          <TextArea label="About your farm (optional)" maxLength={600} value={f.description} onChange={(e) => set("description", e.target.value)} />
          <ChipGroup label="What you grow or sell" options={catLabels} value={f.categories.map((v) => PRODUCE_CATEGORIES.find((c) => c.value === v)?.label ?? v)} onChange={(labels) => set("categories", labels.map((l) => PRODUCE_CATEGORIES.find((c) => c.label === l)?.value ?? l))} />
          <TextInput label="Contact note (optional)" maxLength={200} value={f.contact_note} onChange={(e) => set("contact_note", e.target.value)} hint="e.g. “Replies in the evenings”. Buyers contact you through enquiries." />
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" loading={busy} className="w-full">{exists ? "Save changes" : "Create seller profile"}</Button>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Notice, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";
import { BUSINESS_TYPES, COUNTIES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";

export default function AdvertiserProfilePage() {
  const { supabase, user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [exists, setExists] = useState(false);
  const [f, setF] = useState({ business_name: "", business_type: "local_business", county: "", town: "", description: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from("advertiser_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setExists(true);
        setF({ business_name: data.business_name, business_type: data.business_type, county: data.county ?? "", town: data.town ?? "", description: data.description ?? "", website: data.website ?? "" });
      } else if (profile) setF((p) => ({ ...p, business_name: profile.organisation_name ?? "", county: profile.county ?? "" }));
    });
  }, [supabase, user, profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    if (f.business_name.trim().length < 2) return setMsg({ tone: "error", text: "Enter your business name." });
    if (f.website && !/^https?:\/\/\S+$/i.test(f.website.trim())) return setMsg({ tone: "error", text: "The website must start with http:// or https://" });
    setBusy(true);
    setMsg(null);
    const row = { user_id: user.id, business_name: f.business_name.trim(), business_type: f.business_type, county: f.county || null, town: f.town.trim() || null, description: f.description.trim() || null, website: f.website.trim() || null };
    const { error } = exists ? await supabase.from("advertiser_profiles").update(row).eq("user_id", user.id) : await supabase.from("advertiser_profiles").insert(row);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: friendlyError(error) });
    await refreshProfile();
    if (!exists) router.push("/promote/new");
    else setMsg({ tone: "success", text: "Saved." });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title={exists ? "Business profile" : "Set up your business"} subtitle="This is shown on your sponsored ads." />
      <Card>
        <form onSubmit={save} noValidate className="space-y-5">
          <TextInput label="Business name" required maxLength={80} value={f.business_name} onChange={(e) => set("business_name", e.target.value)} />
          <SelectInput label="Business type" value={f.business_type} onChange={(e) => set("business_type", e.target.value)} options={BUSINESS_TYPES} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput label="County" value={f.county} onChange={(e) => set("county", e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a county" />
            <TextInput label="Town" maxLength={60} value={f.town} onChange={(e) => set("town", e.target.value)} />
          </div>
          <TextArea label="About (optional)" maxLength={400} value={f.description} onChange={(e) => set("description", e.target.value)} />
          <TextInput label="Website (optional)" type="url" value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" loading={busy} className="w-full">{exists ? "Save changes" : "Save and create a campaign"}</Button>
        </form>
      </Card>
    </div>
  );
}

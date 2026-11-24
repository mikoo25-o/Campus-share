"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Notice, PageHeader, SelectInput, TextInput } from "@/components/ui";
import { COUNTIES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";

export default function OnboardingPage() {
  const { supabase, user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [phone, setPhone] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState<"donor" | "receiver">("donor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setCounty(profile.county ?? "");
    setTown(profile.town ?? "");
    setPhone(profile.phone ?? "");
    setOrg(profile.organisation_name ?? "");
    setRole(profile.primary_role);
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (displayName.trim().length < 2) return setError("Choose a display name of at least 2 characters.");
    if (!supabase || !user) return;
    setBusy(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        county: county || null,
        town: town.trim() || null,
        phone: phone.trim() || null,
        organisation_name: org.trim() || null,
        primary_role: role,
        onboarding_done: true,
      })
      .eq("id", user.id);
    if (!err && county) {
      await supabase.from("user_preferences").update({ county, town: town.trim() || null }).eq("user_id", user.id);
    }
    setBusy(false);
    if (err) return setError(friendlyError(err));
    await refreshProfile();
    router.replace("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Finish setting up" subtitle="A few details help us show food and listings near you. Everything here is optional except your display name." />
      <Card>
        <form onSubmit={save} className="space-y-5" noValidate>
          <TextInput label="Display name" required value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} hint="This is the only name other members and the leaderboard see." />
          <SelectInput
            label="How will you mostly use CampusShare?"
            value={role}
            onChange={(e) => setRole(e.target.value as "donor" | "receiver")}
            options={[{ value: "donor", label: "I have food to share" }, { value: "receiver", label: "I want to collect food" }]}
            hint="You can change this any time. Farmers and advertisers can set up those tools later."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput label="County" value={county} onChange={(e) => setCounty(e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a county" />
            <TextInput label="Town or area" value={town} onChange={(e) => setTown(e.target.value)} maxLength={60} />
          </div>
          <TextInput label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} autoComplete="tel" hint="Private. It is never shown to other members." />
          <TextInput label="Organisation or business name" value={org} onChange={(e) => setOrg(e.target.value)} maxLength={80} />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" loading={busy} className="w-full">
            Save and continue
          </Button>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AdCopyAssistant from "@/components/AdCopyAssistant";
import ImageUploader, { type UploadedImage } from "@/components/ImageUploader";
import { Button, Card, ChipGroup, EmptyState, LinkButton, Notice, PageHeader, SelectInput, SponsoredBadge, TextArea, TextInput } from "@/components/ui";
import { AD_PLACEMENTS, CAMPAIGN_OBJECTIVES, CAMPAIGN_TYPES, COUNTIES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { imageUrl } from "@/lib/storage";

const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export default function NewCampaignPage() {
  const { supabase, user, profile } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: "", objective: "awareness", campaign_type: "community_business", headline: "", description: "", destination_url: "", cta_label: "Learn more", start_date: today(), end_date: plus(14), budget: "100", counties: [] as string[], placements: ["dashboard", "find_food", "farmer_market"] as string[] });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [business, setBusiness] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [minBudget, setMinBudget] = useState(50);
  const [cpc, setCpc] = useState(5);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from("advertiser_profiles").select("business_name").eq("user_id", user.id).maybeSingle().then(({ data }) => setBusiness(data?.business_name ?? ""));
    supabase.from("credit_accounts").select("balance").eq("user_id", user.id).maybeSingle().then(({ data }) => setBalance(data?.balance ?? 0));
    supabase.from("platform_settings").select("key, value").in("key", ["min_campaign_budget", "cpc_credits"]).then(({ data }) => {
      (data ?? []).forEach((r: { key: string; value: unknown }) => {
        const n = Number(r.value);
        if (r.key === "min_campaign_budget" && n > 0) setMinBudget(n);
        if (r.key === "cpc_credits" && n > 0) setCpc(n);
      });
    });
  }, [supabase, user]);

  if (profile && !profile.is_advertiser)
    return <EmptyState icon={undefined} title="Set up your business first" text="Advertisers need a short business profile." action={<LinkButton href="/promote/profile">Set up business profile</LinkButton>} />;

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Name your campaign (at least 3 characters).";
    if (f.headline.trim().length < 5) e.headline = "Write a headline of at least 5 characters.";
    if (!/^https?:\/\/[^\s]+$/i.test(f.destination_url.trim())) e.destination_url = "Enter a full link starting with https://";
    if (f.end_date < f.start_date) e.end_date = "The end date must be after the start date.";
    if (f.end_date < today()) e.end_date = "The end date is in the past.";
    const b = Number(f.budget);
    if (!Number.isInteger(b) || b < minBudget) e.budget = `The minimum budget is ${minBudget} credits.`;
    else if (balance !== null && b > balance) e.budget = `You have ${balance} credits. Earn more by sharing food.`;
    if (f.placements.length === 0) e.placements = "Choose at least one placement.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function create(submit: boolean) {
    if (!supabase || !user || !validate()) return;
    setBusy(true);
    setSubmitError("");
    const { data, error } = await supabase.from("ad_campaigns").insert({
      owner_id: user.id,
      name: f.name.trim(),
      objective: f.objective,
      campaign_type: f.campaign_type,
      headline: f.headline.trim(),
      description: f.description.trim() || null,
      image_path: images[0]?.path ?? null,
      destination_url: f.destination_url.trim(),
      cta_label: f.cta_label.trim() || "Learn more",
      target_counties: f.counties,
      placements: f.placements,
      start_date: f.start_date,
      end_date: f.end_date,
      budget_credits: Number(f.budget),
    }).select("id").single();
    if (error) {
      setBusy(false);
      return setSubmitError(friendlyError(error));
    }
    if (submit) {
      const { error: se } = await supabase.rpc("submit_campaign", { p_campaign: data.id });
      if (se) {
        setBusy(false);
        setSubmitError(`Saved as a draft, but it couldn't be submitted: ${friendlyError(se)}`);
        return router.push(`/promote/${data.id}`);
      }
    }
    router.push(`/promote/${data.id}`);
  }

  const preview = imageUrl("campaign-images", images[0]?.path);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Create a campaign" subtitle="Campaigns are paid for with promotional credits and reviewed before they run." />
      <Card className="space-y-5">
        <TextInput label="Campaign name (private)" required maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="Goal" value={f.objective} onChange={(e) => set("objective", e.target.value)} options={CAMPAIGN_OBJECTIVES} />
          <SelectInput label="Ad type" value={f.campaign_type} onChange={(e) => set("campaign_type", e.target.value)} options={CAMPAIGN_TYPES} />
        </div>
        <TextInput label="Headline" required maxLength={70} value={f.headline} onChange={(e) => set("headline", e.target.value)} error={errors.headline} />
        <TextArea label="Short description (optional)" maxLength={200} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <AdCopyAssistant business={business} type={f.campaign_type} headline={f.headline} description={f.description} onApply={(h, d) => { set("headline", h); set("description", d); }} />
        <TextInput label="Where should the ad send people?" required type="url" value={f.destination_url} onChange={(e) => set("destination_url", e.target.value)} placeholder="https://" error={errors.destination_url} hint="Must start with http:// or https://. Moderators check the link." />
        <TextInput label="Button text" maxLength={20} value={f.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
        <ImageUploader bucket="campaign-images" value={images} onChange={setImages} max={1} label="Ad image (optional)" hint="A clear landscape photo works best." camera={false} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Start date" type="date" min={today()} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
          <TextInput label="End date" type="date" min={f.start_date} value={f.end_date} onChange={(e) => set("end_date", e.target.value)} error={errors.end_date} />
        </div>
        <ChipGroup label="Show in these counties (leave empty for all)" options={COUNTIES} value={f.counties} onChange={(v) => set("counties", v)} />
        <ChipGroup label="Placements" options={AD_PLACEMENTS.map((p) => p.label)} value={f.placements.map((v) => AD_PLACEMENTS.find((p) => p.value === v)?.label ?? v)} onChange={(ls) => set("placements", ls.map((l) => AD_PLACEMENTS.find((p) => p.label === l)?.value ?? l))} />
        {errors.placements && <p role="alert" className="text-sm font-medium text-brand-alert">{errors.placements}</p>}
        <TextInput label="Budget (credits)" required type="number" inputMode="numeric" min={minBudget} step="1" value={f.budget} onChange={(e) => set("budget", e.target.value)} error={errors.budget} hint={`You have ${balance ?? "..."} credits. Each click costs ${cpc} credits; impressions are free. Unspent credits are refunded when the campaign ends.`} />

        <div>
          <p className="mb-2 text-sm font-semibold">Preview</p>
          <div className="overflow-hidden rounded-3xl border border-brand-line">
            {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="" className="aspect-[16/7] w-full object-cover" />}
            <div className="space-y-1 p-4">
              <SponsoredBadge />
              <p className="text-lg font-bold">{f.headline || "Your headline"}</p>
              {f.description && <p className="text-sm text-brand-muted">{f.description}</p>}
              <span className="inline-block rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold">{f.cta_label || "Learn more"}</span>
            </div>
          </div>
        </div>

        {submitError && <Notice tone="error">{submitError}</Notice>}
        <div className="flex flex-wrap gap-3">
          <Button loading={busy} onClick={() => void create(true)}>Submit for review</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void create(false)}>Save as draft</Button>
        </div>
        <p className="text-xs text-brand-muted">Submitting uses your credits right away. If the campaign is rejected or ends early, unspent credits come back.</p>
      </Card>
    </div>
  );
}

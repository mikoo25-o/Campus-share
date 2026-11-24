"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import ImageUploader, { type UploadedImage } from "@/components/ImageUploader";
import { Button, Card, ChipGroup, LinkButton, Notice, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";
import { ALLERGEN_OPTIONS, COUNTIES, COUNTY_CENTRES, DIETARY_OPTIONS, FOOD_CATEGORIES, FOOD_UNITS, labelOf } from "@/lib/constants";
import { formatDeadline, formatQty, isoLocalInput } from "@/lib/format";
import { friendlyError } from "@/lib/errors";

const STEPS = ["Food details", "Photos", "Pickup", "Review"] as const;

type Form = {
  title: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  portions: string;
  expires: string;
  storage: string;
  dietary: string[];
  allergens: string[];
  county: string;
  town: string;
  area: string;
  address: string;
  instructions: string;
  phone: string;
  notes: string;
};

export default function DonatePage() {
  const { supabase, user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Form | "images", string>>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState<Form>({
    title: "",
    category: "cooked_meals",
    description: "",
    quantity: "",
    unit: "portions",
    portions: "",
    expires: isoLocalInput(new Date(Date.now() + 4 * 3600000)),
    storage: "",
    dietary: [],
    allergens: [],
    county: profile?.county ?? "",
    town: profile?.town ?? "",
    area: "",
    address: "",
    instructions: "",
    phone: profile?.phone ?? "",
    notes: "",
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  function validate(s: number) {
    const e: typeof errors = {};
    if (s === 0) {
      if (f.title.trim().length < 3) e.title = "Give the food a short name (at least 3 characters).";
      const q = Number(f.quantity);
      if (!f.quantity || !(q > 0)) e.quantity = "Enter how much there is.";
      if (f.portions && !(Number(f.portions) > 0)) e.portions = "Portions must be a positive number.";
      const d = new Date(f.expires);
      if (!f.expires || Number.isNaN(d.getTime())) e.expires = "Choose when this food must be collected by.";
      else if (d.getTime() <= Date.now() + 15 * 60000) e.expires = "Choose a time at least 15 minutes from now.";
    }
    if (s === 1 && images.length === 0) e.images = "Add at least one photo so receivers can see the food.";
    if (s === 2) {
      if (!f.county) e.county = "Choose a county.";
      if (f.town.trim().length < 2) e.town = "Enter the town or area.";
      if (f.address.trim().length < 3) e.address = "Enter the exact pickup address.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validate(step)) setStep((s) => s + 1);
  }

  async function publish() {
    if (!supabase || !user) return;
    for (const s of [0, 1, 2]) {
      if (!validate(s)) {
        setStep(s);
        return;
      }
    }
    setBusy(true);
    setSubmitError("");
    try {
      let id = draftId;
      if (!id) {
        const centre = COUNTY_CENTRES[f.county];
        const { data, error } = await supabase
          .from("food_donations")
          .insert({
            donor_id: user.id,
            title: f.title.trim(),
            category: f.category,
            description: f.description.trim() || null,
            quantity: Number(f.quantity),
            quantity_remaining: Number(f.quantity),
            unit: f.unit,
            portions: f.portions ? Math.round(Number(f.portions)) : null,
            expires_at: new Date(f.expires).toISOString(),
            storage_conditions: f.storage.trim() || null,
            county: f.county,
            town: f.town.trim(),
            area_label: f.area.trim() || null,
            lat: centre ? centre[0] : null,
            lng: centre ? centre[1] : null,
            dietary: f.dietary,
            allergens: f.allergens,
            notes: f.notes.trim() || null,
            status: "draft",
          })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as string;
        setDraftId(id);
      }
      const priv = await supabase.from("donation_private").upsert({
        donation_id: id,
        pickup_address: f.address.trim(),
        pickup_instructions: f.instructions.trim() || null,
        contact_phone: f.phone.trim() || null,
      });
      if (priv.error) throw priv.error;

      const existing = await supabase.from("donation_images").select("storage_path").eq("donation_id", id);
      const have = new Set((existing.data ?? []).map((r) => r.storage_path as string));
      const missing = images.filter((i) => !have.has(i.path));
      if (missing.length) {
        const ins = await supabase
          .from("donation_images")
          .insert(missing.map((i, n) => ({ donation_id: id, storage_path: i.path, sort_order: have.size + n })));
        if (ins.error) throw ins.error;
      }

      const pub = await supabase.from("food_donations").update({ status: "available" }).eq("id", id);
      if (pub.error) throw pub.error;
      setDone(id);
    } catch (e) {
      setSubmitError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-brand-success" aria-hidden="true" />
        <h1 className="text-3xl font-bold">Your food is live</h1>
        <p className="text-brand-muted">Receivers nearby can now see it. You&apos;ll be notified when someone reserves it. Exact pickup details are only shared with the person who reserves.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={`/find-food/${done}`}>View listing</LinkButton>
          <LinkButton href="/activity" variant="secondary">
            Go to my activity
          </LinkButton>
        </div>
      </div>
    );
  }

  const cat = labelOf(FOOD_CATEGORIES, f.category);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Donate food" subtitle="Share surplus food that is safe to eat. It takes about two minutes." />

      <ol className="flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-yellow" : "bg-brand-line"}`} />
            <p className={`mt-1 text-xs font-semibold ${i === step ? "text-brand-ink" : "text-brand-muted"}`}>
              {i + 1}. {s}
            </p>
          </li>
        ))}
      </ol>

      <Card className="space-y-5">
        {step === 0 && (
          <>
            <Notice tone="warn" title="Food safety first">
              Only donate food that is fresh, properly stored and safe to eat. Never share spoiled food, or food past its safe time.
            </Notice>
            <TextInput label="Food name" required maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} error={errors.title} placeholder="e.g. Rice and beans, 12 portions" />
            <SelectInput label="Category" required value={f.category} onChange={(e) => set("category", e.target.value)} options={FOOD_CATEGORIES} />
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Quantity" required type="number" inputMode="decimal" min="0" step="any" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} error={errors.quantity} />
              <SelectInput label="Unit" value={f.unit} onChange={(e) => set("unit", e.target.value)} options={FOOD_UNITS} />
            </div>
            <TextInput label="Approximate portions (optional)" type="number" inputMode="numeric" min="1" value={f.portions} onChange={(e) => set("portions", e.target.value)} error={errors.portions} />
            <TextInput label="Collect by" required type="datetime-local" value={f.expires} onChange={(e) => set("expires", e.target.value)} error={errors.expires} hint="After this time the listing closes automatically." />
            <TextInput label="Storage (optional)" maxLength={200} value={f.storage} onChange={(e) => set("storage", e.target.value)} placeholder="e.g. Kept hot / refrigerated" />
            <TextArea label="Description (optional)" maxLength={500} value={f.description} onChange={(e) => set("description", e.target.value)} />
            <ChipGroup label="Dietary information" options={DIETARY_OPTIONS} value={f.dietary} onChange={(v) => set("dietary", v)} />
            <ChipGroup label="Contains allergens" options={ALLERGEN_OPTIONS} value={f.allergens} onChange={(v) => set("allergens", v)} />
          </>
        )}

        {step === 1 && (
          <>
            <ImageUploader bucket="donation-images" value={images} onChange={setImages} max={5} label="Photos of the food" hint="Clear, well lit photos help food get collected. Up to 5." />
            {errors.images && (
              <p role="alert" className="text-sm font-medium text-brand-alert">
                {errors.images}
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Notice tone="info" title="Your address stays private">
              Receivers see only the county and town. The exact address and instructions are shown only to the person who reserves.
            </Notice>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="County" required value={f.county} onChange={(e) => set("county", e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a county" error={errors.county} />
              <TextInput label="Town or area" required maxLength={60} value={f.town} onChange={(e) => set("town", e.target.value)} error={errors.town} />
            </div>
            <TextInput label="Public landmark (optional)" maxLength={80} value={f.area} onChange={(e) => set("area", e.target.value)} hint="Shown publicly, e.g. “near the main gate”. Don't put your exact address here." />
            <TextInput label="Exact pickup address" required maxLength={200} value={f.address} onChange={(e) => set("address", e.target.value)} error={errors.address} />
            <TextArea label="Pickup instructions (optional)" maxLength={300} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} />
            <TextInput label="Contact phone (optional)" type="tel" maxLength={25} value={f.phone} onChange={(e) => set("phone", e.target.value)} hint="Shared only with the person who reserves." />
            <TextInput label="Public note (optional)" maxLength={300} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-bold">Review your listing</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-brand-muted">Food</dt><dd className="font-semibold">{f.title}</dd></div>
              <div><dt className="text-brand-muted">Category</dt><dd className="font-semibold">{cat}</dd></div>
              <div><dt className="text-brand-muted">Quantity</dt><dd className="font-semibold">{formatQty(f.quantity || 0, f.unit)}</dd></div>
              <div><dt className="text-brand-muted">Collect by</dt><dd className="font-semibold">{f.expires ? formatDeadline(new Date(f.expires).toISOString()) : ""}</dd></div>
              <div><dt className="text-brand-muted">Public location</dt><dd className="font-semibold">{f.town}, {f.county}</dd></div>
              <div><dt className="text-brand-muted">Photos</dt><dd className="font-semibold">{images.length}</dd></div>
            </dl>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" id="safe" className="mt-1 h-5 w-5 accent-brand-forest" onChange={(e) => setErrors(e.target.checked ? {} : { notes: "confirm" })} />
              <span>I confirm this food is safe to eat and has been stored properly.</span>
            </label>
            {errors.notes === "confirm" && <p role="alert" className="text-sm font-medium text-brand-alert">Please confirm before publishing.</p>}
            {submitError && <Notice tone="error">{submitError}</Notice>}
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
            </Button>
          ) : (
            <Link href="/dashboard" className="text-sm font-semibold text-brand-muted hover:underline">Cancel</Link>
          )}
          {step < 3 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button
              loading={busy}
              onClick={() => {
                const box = document.getElementById("safe") as HTMLInputElement | null;
                if (!box?.checked) return setErrors({ notes: "confirm" });
                void publish();
              }}
            >
              Publish food
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import ImageUploader, { type UploadedImage } from "./ImageUploader";
import ListingAssistant from "./ListingAssistant";
import { Button, Card, ChipGroup, ErrorState, Notice, SelectInput, Skeleton, TextArea, TextInput } from "./ui";
import { COUNTIES, DELIVERY_OPTIONS, PRODUCE_CATEGORIES, PRODUCE_UNITS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import type { Listing } from "@/lib/types";

type Form = { name: string; category: string; description: string; price: string; unit: string; quantity: string; harvest: string; from: string; county: string; town: string; delivery: string[]; keywords: string; status: "active" | "paused" };

export default function ListingForm({ listingId }: { listingId?: string }) {
  const { supabase, user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(!!listingId);
  const [loadError, setLoadError] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [f, setF] = useState<Form>({ name: "", category: "vegetables", description: "", price: "", unit: "kg", quantity: "", harvest: "", from: "", county: profile?.county ?? "", town: profile?.town ?? "", delivery: ["collection"], keywords: "", status: "active" });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!listingId || !supabase) return;
    supabase.from("produce_listings").select("*, produce_images(id, storage_path, sort_order)").eq("id", listingId).maybeSingle().then(({ data, error }) => {
      setLoading(false);
      if (error || !data) return setLoadError("We couldn't load this listing.");
      const l = data as Listing;
      if (l.farmer_id !== user?.id) return setLoadError("You can only edit your own listings.");
      setF({ name: l.name, category: l.category, description: l.description ?? "", price: String(l.price), unit: l.unit, quantity: String(l.quantity_available), harvest: l.harvest_date ?? "", from: l.available_from ?? "", county: l.county, town: l.town ?? "", delivery: l.delivery_options, keywords: l.keywords.join(", "), status: l.status === "paused" ? "paused" : "active" });
      const imgs = [...(l.produce_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      setImages(imgs.map((i) => ({ path: i.storage_path })));
      setExisting(new Set(imgs.map((i) => i.storage_path)));
    });
  }, [listingId, supabase, user?.id]);

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Give the produce a name (at least 3 characters).";
    if (f.price === "" || Number(f.price) < 0) e.price = "Enter a price (0 or more).";
    if (f.quantity === "" || Number(f.quantity) < 0) e.quantity = "Enter how much you have.";
    if (!f.county) e.county = "Choose a county.";
    if (images.length === 0) e.images = "Add at least one photo.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!supabase || !user || !validate()) return;
    setBusy(true);
    setSubmitError("");
    try {
      const row = {
        farmer_id: user.id,
        name: f.name.trim(),
        category: f.category,
        description: f.description.trim() || null,
        price: Number(f.price),
        unit: f.unit,
        quantity_available: Number(f.quantity),
        harvest_date: f.harvest || null,
        available_from: f.from || null,
        county: f.county,
        town: f.town.trim() || null,
        delivery_options: f.delivery,
        keywords: f.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 10),
        status: f.status,
      };
      let id = listingId;
      if (id) {
        const { farmer_id: _omit, ...patch } = row;
        void _omit;
        const { error } = await supabase.from("produce_listings").update(patch).eq("id", id);
        if (error) throw error;
        const removed = Array.from(existing).filter((p) => !images.some((i) => i.path === p));
        if (removed.length) {
          const { error: de } = await supabase.from("produce_images").delete().eq("listing_id", id).in("storage_path", removed);
          if (de) throw de;
        }
      } else {
        const { data, error } = await supabase.from("produce_listings").insert(row).select("id").single();
        if (error) throw error;
        id = data.id as string;
      }
      const fresh = images.filter((i) => !existing.has(i.path));
      if (fresh.length) {
        const { error } = await supabase.from("produce_images").insert(fresh.map((i, n) => ({ listing_id: id, storage_path: i.path, sort_order: images.indexOf(i) + n * 0 })));
        if (error) throw error;
      }
      router.push(`/farmer-market/${id}`);
    } catch (e) {
      setSubmitError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!supabase || !listingId || !window.confirm("Delete this listing? This can't be undone.")) return;
    const { error } = await supabase.from("produce_listings").delete().eq("id", listingId);
    if (error) return setSubmitError(friendlyError(error));
    router.push("/farmer-market/mine");
  }

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <Card>
      <form onSubmit={save} noValidate className="space-y-5">
        <TextInput label="Produce name" required maxLength={120} value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} placeholder="e.g. Fresh sukuma wiki" />
        <SelectInput label="Category" value={f.category} onChange={(e) => set("category", e.target.value)} options={PRODUCE_CATEGORIES} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Price (KSh)" required type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={(e) => set("price", e.target.value)} error={errors.price} />
          <SelectInput label="Sold" value={f.unit} onChange={(e) => set("unit", e.target.value)} options={PRODUCE_UNITS} />
          <TextInput label="Quantity available" required type="number" inputMode="decimal" min="0" step="any" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} error={errors.quantity} />
        </div>
        <TextArea label="Description (optional)" maxLength={1000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <ListingAssistant name={f.name} category={f.category} description={f.description} county={f.county} onApply={(v) => { if (v.description) set("description", v.description); if (v.keywords) set("keywords", v.keywords.join(", ")); }} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Harvest date (optional)" type="date" value={f.harvest} onChange={(e) => set("harvest", e.target.value)} />
          <TextInput label="Available from (optional)" type="date" value={f.from} onChange={(e) => set("from", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="County" required value={f.county} onChange={(e) => set("county", e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a county" error={errors.county} />
          <TextInput label="Town or area" maxLength={60} value={f.town} onChange={(e) => set("town", e.target.value)} />
        </div>
        <ChipGroup label="How buyers get it" options={DELIVERY_OPTIONS.map((d) => d.label)} value={f.delivery.map((v) => DELIVERY_OPTIONS.find((d) => d.value === v)?.label ?? v)} onChange={(ls) => set("delivery", ls.map((l) => DELIVERY_OPTIONS.find((d) => d.label === l)?.value ?? l))} />
        <TextInput label="Search keywords (optional)" value={f.keywords} onChange={(e) => set("keywords", e.target.value)} hint="Comma separated, e.g. organic, kale, greens" />
        <ImageUploader bucket="produce-images" value={images} onChange={setImages} max={5} label="Photos" hint="Show the actual produce. Up to 5." />
        {errors.images && <p role="alert" className="text-sm font-medium text-brand-alert">{errors.images}</p>}
        {listingId && (
          <SelectInput label="Visibility" value={f.status} onChange={(e) => set("status", e.target.value as "active" | "paused")} options={[{ value: "active", label: "Visible to buyers" }, { value: "paused", label: "Paused (hidden)" }]} />
        )}
        {submitError && <Notice tone="error">{submitError}</Notice>}
        <div className="flex flex-wrap justify-between gap-3">
          <Button type="submit" loading={busy}>{listingId ? "Save changes" : "Publish listing"}</Button>
          {listingId && <Button variant="danger" onClick={() => void remove()}>Delete listing</Button>}
        </div>
      </form>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Clock, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import ReportButton from "@/components/ReportButton";
import { Badge, Button, Card, ErrorState, LinkButton, Modal, Notice, Skeleton, TextInput } from "@/components/ui";
import { FOOD_CATEGORIES, labelOf } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDeadline, formatQty, hoursLeft, timeAgo } from "@/lib/format";
import { imageUrl } from "@/lib/storage";
import type { Donation, PublicProfile, Reservation } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type Detail = {
  donation: Donation;
  donor: PublicProfile | null;
  mine: Reservation | null;
  code: string | null;
  priv: { pickup_address: string; pickup_instructions: string | null; contact_phone: string | null } | null;
};

export default function FoodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { supabase, user } = useAuth();
  const [qty, setQty] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [photo, setPhoto] = useState(0);

  const { data, error, loading, reload } = useAsync<Detail | null>(
    async () => {
      const { data: d, error: e } = await supabase!
        .from("food_donations")
        .select("*, donation_images(id, storage_path, sort_order)")
        .eq("id", id)
        .maybeSingle();
      if (e) throw e;
      if (!d) return null;
      const donation = d as Donation;
      const donor = unwrap(await supabase!.from("public_profiles").select("*").eq("id", donation.donor_id).maybeSingle()) as PublicProfile | null;
      let mine: Reservation | null = null;
      let code: string | null = null;
      let priv: Detail["priv"] = null;
      if (user) {
        const r = unwrap(
          await supabase!.from("food_reservations").select("*").eq("donation_id", id).eq("receiver_id", user.id).eq("status", "reserved").maybeSingle(),
        ) as Reservation | null;
        mine = r;
        if (r) {
          code = (unwrap(await supabase!.from("reservation_codes").select("code").eq("reservation_id", r.id).maybeSingle()) as { code: string } | null)?.code ?? null;
        }
        if (r || donation.donor_id === user.id) {
          priv = unwrap(await supabase!.from("donation_private").select("*").eq("donation_id", id).maybeSingle()) as Detail["priv"];
        }
      }
      return { donation, donor, mine, code, priv };
    },
    [id, user?.id],
    !!supabase,
  );

  async function reserve() {
    if (!supabase || !data) return;
    const n = Number(qty);
    if (!(n > 0) || n > Number(data.donation.quantity_remaining)) return setActionError(`Enter an amount between 0 and ${data.donation.quantity_remaining}.`);
    setBusy(true);
    setActionError("");
    const { error: e } = await supabase.rpc("reserve_donation", { p_donation: id, p_quantity: n });
    setBusy(false);
    if (e) return setActionError(friendlyError(e));
    setOpen(false);
    await reload();
  }

  async function cancelReservation() {
    if (!supabase || !data?.mine) return;
    setBusy(true);
    const { error: e } = await supabase.rpc("cancel_reservation", { p_reservation: data.mine.id });
    setBusy(false);
    if (e) return setActionError(friendlyError(e));
    await reload();
  }

  async function cancelDonation() {
    if (!supabase || !window.confirm("Cancel this donation? Anyone who reserved it will be told.")) return;
    setBusy(true);
    const { error: e } = await supabase.rpc("cancel_donation", { p_donation: id });
    setBusy(false);
    if (e) return setActionError(friendlyError(e));
    router.push("/activity");
  }

  if (!supabase) return <ErrorState message="Database not connected." />;
  if (loading) return <Skeleton className="h-96 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data)
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">This food is no longer available</h1>
        <p className="text-brand-muted">It may have been collected, or its collection time has passed.</p>
        <LinkButton href="/find-food">Find other food</LinkButton>
      </div>
    );

  const { donation: d, donor, mine, code, priv } = data;
  const isOwner = user?.id === d.donor_id;
  const images = [...(d.donation_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const live = d.status === "available" && hoursLeft(d.expires_at) > 0 && Number(d.quantity_remaining) > 0;
  const hasAllergens = d.allergens.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/find-food" className="text-sm font-semibold text-brand-muted hover:underline">← Back to Find food</Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-brand-line bg-brand-line/40">
            {images.length ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl("donation-images", images[photo]?.storage_path) ?? ""} alt={d.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-brand-muted">No photo</div>
            )}
          </div>
          {images.length > 1 && (
            <ul className="flex gap-2 overflow-x-auto">
              {images.map((im, i) => (
                <li key={im.id}>
                  <button type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} aria-current={i === photo} className={`h-16 w-16 overflow-hidden rounded-xl border-2 ${i === photo ? "border-brand-yellow" : "border-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl("donation-images", im.storage_path) ?? ""} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{labelOf(FOOD_CATEGORIES, d.category)}</Badge>
            <Badge tone={live ? "green" : "red"}>{live ? "Available" : d.status === "reserved" ? "Reserved" : d.status}</Badge>
          </div>
          <h1 className="text-3xl font-bold leading-tight">{d.title}</h1>
          <p className="text-lg font-semibold">{formatQty(d.quantity_remaining, d.unit)} left{d.portions ? ` · about ${d.portions} portions` : ""}</p>
          <ul className="space-y-1.5 text-sm text-brand-muted">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{d.town}, {d.county}{d.area_label ? ` · ${d.area_label}` : ""}</li>
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden="true" />Collect by {formatDeadline(d.expires_at)}</li>
            {d.storage_conditions && <li>Storage: {d.storage_conditions}</li>}
          </ul>
          {d.description && <p>{d.description}</p>}
          {d.notes && <p className="text-sm text-brand-muted">Note: {d.notes}</p>}

          {d.dietary.length > 0 && <div className="flex flex-wrap gap-2">{d.dietary.map((x) => <Badge key={x} tone="green">{x}</Badge>)}</div>}
          {hasAllergens && (
            <Notice tone="warn" title="Contains allergens">
              {d.allergens.join(", ")}
            </Notice>
          )}
          <p className="text-sm text-brand-muted">Shared by <strong className="text-brand-ink">{donor?.organisation_name || donor?.display_name || "a CampusShare member"}</strong> · listed {timeAgo(d.created_at)}</p>

          {actionError && <Notice tone="error">{actionError}</Notice>}

          {mine && (
            <Card className="space-y-3 border-brand-yellow bg-brand-yellow/10">
              <h2 className="text-lg font-bold">You reserved {formatQty(mine.quantity, d.unit)}</h2>
              {code && (
                <div>
                  <p className="text-sm text-brand-muted">Show this code to the donor when you collect. Don&apos;t share it before.</p>
                  <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em]" aria-label={`Handover code ${code.split("").join(" ")}`}>{code}</p>
                </div>
              )}
              {priv && (
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Pickup address</p>
                  <p>{priv.pickup_address}</p>
                  {priv.pickup_instructions && <p className="text-brand-muted">{priv.pickup_instructions}</p>}
                  {priv.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden="true" /><a className="underline" href={`tel:${priv.contact_phone}`}>{priv.contact_phone}</a></p>}
                </div>
              )}
              <Button variant="secondary" loading={busy} onClick={() => void cancelReservation()}>Cancel my reservation</Button>
            </Card>
          )}

          {isOwner && (
            <Card className="space-y-3">
              <p className="font-semibold">This is your donation.</p>
              {priv && <p className="text-sm text-brand-muted">Pickup: {priv.pickup_address}</p>}
              <div className="flex flex-wrap gap-2">
                <LinkButton href="/activity" variant="secondary">Manage in My Activity</LinkButton>
                {(d.status === "available" || d.status === "draft") && <Button variant="danger" loading={busy} onClick={() => void cancelDonation()}>Cancel donation</Button>}
              </div>
            </Card>
          )}

          {!mine && !isOwner && live && (
            user ? (
              <Button className="w-full" onClick={() => { setQty(String(d.quantity_remaining)); setActionError(""); setOpen(true); }}>Reserve this food</Button>
            ) : (
              <LinkButton href={`/login?next=/find-food/${id}`} className="w-full">Log in to reserve</LinkButton>
            )
          )}

          <div className="flex items-start gap-2 rounded-2xl bg-brand-line/40 p-3 text-xs text-brand-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>CampusShare doesn&apos;t inspect food. Check it is fresh before eating and avoid anything you&apos;re unsure of. <Link href="/help" className="underline">Food safety tips</Link></p>
          </div>
          {!isOwner && <ReportButton type="donation" targetId={d.id} label="Report this listing" />}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Reserve this food">
        <div className="space-y-4">
          <TextInput label={`How much do you need? (${d.unit})`} type="number" inputMode="decimal" min="0" max={String(d.quantity_remaining)} step="any" value={qty} onChange={(e) => setQty(e.target.value)} hint={`Up to ${formatQty(d.quantity_remaining, d.unit)} available.`} />
          <p className="flex items-start gap-2 text-sm text-brand-muted"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Reserve only what you will collect. You&apos;ll get a code and the exact address after reserving.</p>
          {actionError && <Notice tone="error">{actionError}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={() => void reserve()}>Confirm reservation</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

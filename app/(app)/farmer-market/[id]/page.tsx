"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Heart, MapPin } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import ReportButton from "@/components/ReportButton";
import { Badge, Button, Card, ErrorState, LinkButton, Notice, Skeleton, TextArea, TextInput } from "@/components/ui";
import { DELIVERY_OPTIONS, PRODUCE_CATEGORIES, PRODUCE_UNITS, labelOf } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatKES, formatQty } from "@/lib/format";
import { imageUrl } from "@/lib/storage";
import type { Listing } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { supabase, user } = useAuth();
  const [photo, setPhoto] = useState(0);
  const [message, setMessage] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const { data, error, loading, reload } = useAsync<{ l: Listing | null; fav: boolean }>(
    async () => {
      const { data: l, error: e } = await supabase!
        .from("produce_listings")
        .select("*, produce_images(id, storage_path, sort_order), farmer_profiles(*)")
        .eq("id", id)
        .maybeSingle();
      if (e) throw e;
      let fav = false;
      if (user && l) fav = !!unwrap(await supabase!.from("favourites").select("listing_id").eq("user_id", user.id).eq("listing_id", id).maybeSingle());
      return { l: l as Listing | null, fav };
    },
    [id, user?.id],
    !!supabase,
  );

  async function toggleFav() {
    if (!supabase || !user || !data) return;
    const { error: e } = data.fav
      ? await supabase.from("favourites").delete().eq("user_id", user.id).eq("listing_id", id)
      : await supabase.from("favourites").insert({ user_id: user.id, listing_id: id });
    if (e) setNote({ tone: "error", text: friendlyError(e) });
    else await reload();
  }

  async function send() {
    if (!supabase) return;
    if (message.trim().length < 5) return setNote({ tone: "error", text: "Write a short message (at least 5 characters)." });
    setBusy(true);
    setNote(null);
    const { error: e } = await supabase.rpc("send_enquiry", { p_listing: id, p_message: message.trim(), p_quantity: qty ? Number(qty) : null });
    setBusy(false);
    if (e) return setNote({ tone: "error", text: friendlyError(e) });
    setMessage("");
    setQty("");
    setNote({ tone: "success", text: "Enquiry sent. The farmer will reply here and you'll be notified." });
  }

  if (!supabase) return <ErrorState message="Database not connected." />;
  if (loading) return <Skeleton className="h-96 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const l = data?.l;
  if (!l)
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">This listing isn&apos;t available</h1>
        <LinkButton href="/farmer-market">Back to Farmer market</LinkButton>
      </div>
    );

  const images = [...(l.produce_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const isOwner = user?.id === l.farmer_id;
  const unit = labelOf(PRODUCE_UNITS, l.unit).replace("per ", "");
  const f = l.farmer_profiles;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/farmer-market" className="text-sm font-semibold text-brand-muted hover:underline">← Back to Farmer market</Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-brand-line bg-brand-line/40">
            {images.length ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl("produce-images", images[photo]?.storage_path) ?? ""} alt={l.name} className="h-full w-full object-cover" />
            ) : <div className="flex h-full items-center justify-center text-brand-muted">No photo</div>}
          </div>
          {images.length > 1 && (
            <ul className="flex gap-2 overflow-x-auto">
              {images.map((im, i) => (
                <li key={im.id}>
                  <button type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} aria-current={i === photo} className={`h-16 w-16 overflow-hidden rounded-xl border-2 ${i === photo ? "border-brand-yellow" : "border-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl("produce-images", im.storage_path) ?? ""} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{labelOf(PRODUCE_CATEGORIES, l.category)}</Badge>
            <Badge tone={l.status === "active" ? "green" : "red"}>{l.status === "active" ? "In stock" : "Sold out"}</Badge>
          </div>
          <h1 className="text-3xl font-bold leading-tight">{l.name}</h1>
          <p className="text-2xl font-bold">{formatKES(l.price)} <span className="text-base font-normal text-brand-muted">per {unit}</span></p>
          <ul className="space-y-1 text-sm text-brand-muted">
            <li>{formatQty(l.quantity_available, l.unit)} available</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{l.town ? `${l.town}, ` : ""}{l.county}</li>
            {l.harvest_date && <li>Harvested {formatDate(l.harvest_date)}</li>}
            {l.available_from && <li>Available from {formatDate(l.available_from)}</li>}
            {l.delivery_options.length > 0 && <li>{l.delivery_options.map((o) => labelOf(DELIVERY_OPTIONS, o)).join(" · ")}</li>}
          </ul>
          {l.description && <p>{l.description}</p>}
          {f && (
            <Card className="text-sm">
              <p className="text-brand-muted">Sold by</p>
              <Link href={`/farmers/${f.user_id}`} className="text-lg font-bold hover:underline">{f.farm_name}</Link>
              <p className="text-brand-muted">{f.farmer_name} · {f.county}</p>
              {f.contact_note && <p className="mt-1">{f.contact_note}</p>}
            </Card>
          )}

          {note && <Notice tone={note.tone}>{note.text}</Notice>}

          {isOwner ? (
            <LinkButton href={`/farmer-market/${l.id}/edit`} variant="secondary">Edit this listing</LinkButton>
          ) : user ? (
            <Card className="space-y-3">
              <h2 className="text-lg font-bold">Ask the farmer</h2>
              <p className="text-sm text-brand-muted">Agree the price, quantity and how you&apos;ll get it directly with the farmer. CampusShare doesn&apos;t handle payment.</p>
              <TextArea label="Your message" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="Hi, is this still available? I'd like to..." />
              <TextInput label={`Quantity you're interested in (${l.unit}, optional)`} type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button loading={busy} onClick={() => void send()}>Send enquiry</Button>
                <Button variant="secondary" onClick={() => void toggleFav()} aria-pressed={data?.fav}>
                  <Heart className={`h-4 w-4 ${data?.fav ? "fill-brand-alert text-brand-alert" : ""}`} aria-hidden="true" />
                  {data?.fav ? "Saved" : "Save"}
                </Button>
              </div>
            </Card>
          ) : (
            <LinkButton href={`/login?next=/farmer-market/${id}`}>Log in to contact the farmer</LinkButton>
          )}
          {!isOwner && <ReportButton type="listing" targetId={l.id} label="Report this listing" />}
        </div>
      </div>
    </div>
  );
}

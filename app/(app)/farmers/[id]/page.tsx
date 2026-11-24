"use client";

import { useParams } from "next/navigation";
import { MapPin } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, ErrorState, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import type { FarmerProfile, Listing } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

export default function FarmerPage() {
  const { id } = useParams<{ id: string }>();
  const { supabase } = useAuth();
  const { data, error, loading, reload } = useAsync<{ f: FarmerProfile | null; listings: Listing[] }>(
    async () => {
      const f = unwrap(await supabase!.from("farmer_profiles").select("*").eq("user_id", id).maybeSingle()) as FarmerProfile | null;
      const listings = f
        ? (unwrap(
            await supabase!.from("produce_listings").select("*, produce_images(id, storage_path, sort_order), farmer_profiles(*)").eq("farmer_id", id).in("status", ["active", "sold_out"]).order("created_at", { ascending: false }),
          ) as Listing[])
        : [];
      return { f, listings };
    },
    [id],
    !!supabase,
  );
  if (loading) return <Skeleton className="h-64 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.f) return <EmptyState title="Farmer not found" action={<LinkButton href="/farmer-market">Back to Farmer market</LinkButton>} />;
  const f = data.f;
  return (
    <div className="space-y-6">
      <PageHeader title={f.farm_name} subtitle={f.farmer_name} />
      <p className="flex items-center gap-2 text-sm text-brand-muted"><MapPin className="h-4 w-4" aria-hidden="true" />{f.town ? `${f.town}, ` : ""}{f.county}</p>
      {f.description && <p className="max-w-2xl">{f.description}</p>}
      {f.contact_note && <p className="text-sm text-brand-muted">{f.contact_note}</p>}
      <h2 className="text-xl font-bold">Produce</h2>
      {data.listings.length === 0 ? <EmptyState title="Nothing listed right now" /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>}
    </div>
  );
}

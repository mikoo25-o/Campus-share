"use client";

import Link from "next/link";
import { MessageSquare, Wheat } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, ErrorState, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import type { Listing } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

export default function MyListingsPage() {
  const { supabase, user, profile } = useAuth();
  const { data, error, loading, reload } = useAsync<Listing[]>(
    async () => unwrap(await supabase!.from("produce_listings").select("*, produce_images(id, storage_path, sort_order), farmer_profiles(*)").eq("farmer_id", user!.id).neq("status", "removed").order("created_at", { ascending: false })) as Listing[],
    [user?.id],
    !!supabase && !!user,
  );
  return (
    <div className="space-y-6">
      <PageHeader title="My produce" action={<div className="flex gap-2"><LinkButton href="/farmer-market/enquiries" variant="secondary"><MessageSquare className="h-4 w-4" aria-hidden="true" />Enquiries</LinkButton><LinkButton href="/farmer-market/new">List produce</LinkButton></div>} />
      {profile && !profile.is_farmer ? (
        <EmptyState icon={Wheat} title="You're not a seller yet" action={<LinkButton href="/farmer-market/profile">Create seller profile</LinkButton>} />
      ) : loading ? <Skeleton className="h-64 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={Wheat} title="No produce listed yet" action={<LinkButton href="/farmer-market/new">List produce</LinkButton>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((l) => (
            <div key={l.id} className="space-y-2">
              <ListingCard l={l} />
              <Link href={`/farmer-market/${l.id}/edit`} className="block text-center text-sm font-semibold underline">Edit{l.status === "paused" ? " (paused)" : ""}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

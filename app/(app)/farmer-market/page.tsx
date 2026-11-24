"use client";

import { useMemo, useState } from "react";
import { Heart, Search, Wheat } from "lucide-react";
import AdSlot from "@/components/AdSlot";
import ListingCard from "@/components/ListingCard";
import { useAuth } from "@/components/AuthProvider";
import { Button, EmptyState, ErrorState, LinkButton, PageHeader, SelectInput, Skeleton, TextInput } from "@/components/ui";
import { COUNTIES, PRODUCE_CATEGORIES } from "@/lib/constants";
import type { Listing } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type Sort = "newest" | "price_asc" | "price_desc";

export default function FarmerMarketPage() {
  const { supabase, user, profile } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [county, setCounty] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [onlyFav, setOnlyFav] = useState(false);

  const { data, error, loading, reload } = useAsync<Listing[]>(
    async () =>
      unwrap(
        await supabase!
          .from("produce_listings")
          .select("*, produce_images(id, storage_path, sort_order), farmer_profiles(*)")
          .in("status", ["active", "sold_out"])
          .order("created_at", { ascending: false })
          .limit(200),
      ) as Listing[],
    [],
    !!supabase,
  );
  const favs = useAsync<string[]>(
    async () => (unwrap(await supabase!.from("favourites").select("listing_id").eq("user_id", user!.id)) as { listing_id: string }[]).map((r) => r.listing_id),
    [user?.id],
    !!supabase && !!user,
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fav = new Set(favs.data ?? []);
    const list = (data ?? []).filter((l) => {
      if (category && l.category !== category) return false;
      if (county && l.county !== county) return false;
      if (onlyFav && !fav.has(l.id)) return false;
      if (needle && !`${l.name} ${l.description ?? ""} ${l.keywords.join(" ")} ${l.county} ${l.farmer_profiles?.farm_name ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return list.sort((a, b) =>
      sort === "price_asc" ? Number(a.price) - Number(b.price) : sort === "price_desc" ? Number(b.price) - Number(a.price) : +new Date(b.created_at) - +new Date(a.created_at),
    );
  }, [data, q, category, county, sort, onlyFav, favs.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmer market"
        subtitle="Buy fresh produce directly from farmers. Send an enquiry and agree price, pickup or delivery with the farmer. No payments happen on CampusShare."
        action={user ? <LinkButton href={profile?.is_farmer ? "/farmer-market/new" : "/farmer-market/profile"}>{profile?.is_farmer ? "List produce" : "Become a seller"}</LinkButton> : undefined}
      />

      <div className="space-y-3 rounded-3xl border border-brand-line bg-white p-4">
        <TextInput label="Search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tomatoes, maize, eggs..." />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectInput label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={PRODUCE_CATEGORIES} placeholder="All categories" />
          <SelectInput label="County" value={county} onChange={(e) => setCounty(e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="All counties" />
          <SelectInput label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} options={[{ value: "newest", label: "Newest" }, { value: "price_asc", label: "Price: low to high" }, { value: "price_desc", label: "Price: high to low" }]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {user ? (
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-brand-forest" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} />
              <Heart className="h-4 w-4" aria-hidden="true" /> Saved only
            </label>
          ) : <span />}
          {(q || category || county || onlyFav) && <Button variant="ghost" onClick={() => { setQ(""); setCategory(""); setCounty(""); setOnlyFav(false); }}>Clear filters</Button>}
        </div>
      </div>

      <AdSlot placement="farmer_market" county={county || profile?.county} />

      {!supabase ? (
        <EmptyState icon={Search} title="Database not connected" text="Add your Supabase keys to .env.local to see real listings." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Wheat} title={q || category || county || onlyFav ? "No produce matches those filters" : "No produce listed yet"} text="Farmers can list their harvest for buyers across Kenya." action={<LinkButton href={user ? "/farmer-market/profile" : "/get-started"}>{user ? "Become a seller" : "Join CampusShare"}</LinkButton>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      )}
    </div>
  );
}

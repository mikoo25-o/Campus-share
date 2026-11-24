"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { List, Map as MapIcon, Search, ShoppingBasket } from "lucide-react";
import AdSlot from "@/components/AdSlot";
import FoodCard from "@/components/FoodCard";
import { useAuth } from "@/components/AuthProvider";
import { Button, EmptyState, ErrorState, LinkButton, PageHeader, SelectInput, Skeleton, Tabs, TextInput } from "@/components/ui";
import { COUNTIES, COUNTY_CENTRES, DIETARY_OPTIONS, FOOD_CATEGORIES } from "@/lib/constants";
import { distanceKm } from "@/lib/format";
import type { Donation } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

const FoodMap = dynamic(() => import("@/components/FoodMap"), { ssr: false, loading: () => <Skeleton className="h-[420px] w-full rounded-3xl" /> });

type Sort = "soonest" | "newest" | "nearest";

export default function FindFoodPage() {
  const { supabase, user, profile } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [county, setCounty] = useState("");
  const [dietary, setDietary] = useState("");
  const [soon, setSoon] = useState(false);
  const [sort, setSort] = useState<Sort>("soonest");
  const [view, setView] = useState<"list" | "map">("list");

  const { data, error, loading, reload } = useAsync<Donation[]>(
    async () =>
      unwrap(
        await supabase!
          .from("food_donations")
          .select("*, donation_images(id, storage_path, sort_order)")
          .eq("status", "available")
          .gt("expires_at", new Date().toISOString())
          .gt("quantity_remaining", 0)
          .order("expires_at", { ascending: true })
          .limit(200),
      ) as Donation[],
    [],
    !!supabase,
  );

  const mine = profile?.county ? COUNTY_CENTRES[profile.county] : undefined;
  const kmOf = (d: Donation) => {
    const c = COUNTY_CENTRES[d.county];
    return mine && c ? distanceKm(mine, c) : null;
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = (data ?? []).filter((d) => {
      if (category && d.category !== category) return false;
      if (county && d.county !== county) return false;
      if (dietary && !d.dietary.includes(dietary)) return false;
      if (soon && new Date(d.expires_at).getTime() - Date.now() > 3 * 3600000) return false;
      if (needle && !`${d.title} ${d.description ?? ""} ${d.town} ${d.county}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "newest") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "nearest") return (kmOf(a) ?? 1e9) - (kmOf(b) ?? 1e9);
      return +new Date(a.expires_at) - +new Date(b.expires_at);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, category, county, dietary, soon, sort, mine]);

  const filtered = !!(q || category || county || dietary || soon);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find food"
        subtitle="Free food shared by people near you. Reserve what you need, then collect it before the deadline."
        action={user ? <LinkButton href="/donate">Donate food</LinkButton> : undefined}
      />

      <div className="space-y-3 rounded-3xl border border-brand-line bg-white p-4">
        <TextInput label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rice, bread, vegetables..." type="search" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectInput label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={FOOD_CATEGORIES} placeholder="All categories" />
          <SelectInput label="County" value={county} onChange={(e) => setCounty(e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} placeholder="All counties" />
          <SelectInput label="Dietary" value={dietary} onChange={(e) => setDietary(e.target.value)} options={DIETARY_OPTIONS.map((d) => ({ value: d, label: d }))} placeholder="Any" />
          <SelectInput
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            options={[
              { value: "soonest", label: "Collect soonest" },
              { value: "newest", label: "Newest" },
              { value: "nearest", label: "Nearest to my county" },
            ]}
            hint={sort === "nearest" && !mine ? "Add your county in Profile to sort by distance." : undefined}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-brand-forest" checked={soon} onChange={(e) => setSoon(e.target.checked)} />
            Collect within 3 hours
          </label>
          {filtered && (
            <Button variant="ghost" onClick={() => { setQ(""); setCategory(""); setCounty(""); setDietary(""); setSoon(false); }}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-muted" aria-live="polite">{loading ? "Loading..." : `${rows.length} available`}</p>
        <Tabs
          label="View"
          value={view}
          onChange={setView}
          items={[
            { value: "list", label: "List", icon: List },
            { value: "map", label: "Map", icon: MapIcon },
          ]}
        />
      </div>

      <AdSlot placement="find_food" county={county || profile?.county} category={category || null} />

      {!supabase ? (
        <EmptyState icon={Search} title="Database not connected" text="Add your Supabase keys to .env.local to see real listings." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title={filtered ? "No food matches those filters" : "No food available right now"}
          text={filtered ? "Try removing a filter or choosing another county." : "New food is shared throughout the day. Check back soon, or share some yourself."}
          action={user ? <LinkButton href="/donate">Donate food</LinkButton> : <LinkButton href="/get-started">Join CampusShare</LinkButton>}
        />
      ) : view === "map" ? (
        <FoodMap items={rows} onSelectCounty={(c) => { setCounty(c); setView("list"); }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => <FoodCard key={d.id} d={d} km={kmOf(d)} />)}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Globe, HandHeart, Leaf, ShoppingBasket, Users } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Impact = { kg: number; meals: number; people: number; partners: number; co2e_kg_estimate: number };
const ZERO: Impact = { kg: 0, meals: 0, people: 0, partners: 0, co2e_kg_estimate: 0 };
const n = (v: number) => Math.round(Number(v) || 0).toLocaleString();

/** Verified totals read from the database. Shows real zeros until food has been collected. */
export default function ImpactStats() {
  const [i, setI] = useState<Impact>(ZERO);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.rpc("platform_impact").then(({ data }) => data && setI({ ...ZERO, ...(data as Impact) }));
  }, []);
  const items = [
    { label: "Food rescued", value: `${n(i.kg)} kg`, icon: ShoppingBasket },
    { label: "Meals shared", value: n(i.meals), icon: HandHeart },
    { label: "People supported", value: n(i.people), icon: Users },
    { label: "Donors and partners", value: n(i.partners), icon: Leaf },
    { label: "CO2e avoided (estimate)", value: `${n(i.co2e_kg_estimate)} kg`, icon: Globe },
  ];
  return (
    <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-yellow/30 text-brand-gold"><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <div><dd className="text-lg font-bold leading-tight">{value}</dd><dt className="text-xs text-brand-muted">{label}</dt></div>
        </div>
      ))}
    </dl>
  );
}

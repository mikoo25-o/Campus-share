"use client";

import Link from "next/link";
import { Gift, Heart, Megaphone, ShoppingBasket, Sparkles, Wheat } from "lucide-react";
import AdSlot from "@/components/AdSlot";
import { useAuth } from "@/components/AuthProvider";
import { Card, ErrorState, LinkButton, PageHeader, Skeleton, StatTile } from "@/components/ui";
import type { CreditAccount } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type Impact = { donated_collections: number; donated_kg: number; received_collections: number; active_listings: number; open_enquiries: number; active_reservations: number; live_donations: number };

export default function DashboardPage() {
  const { supabase, user, profile } = useAuth();
  const { data, error, loading, reload } = useAsync<{ i: Impact; credits: number }>(
    async () => {
      const i = unwrap(await supabase!.rpc("user_impact")) as Impact;
      const a = unwrap(await supabase!.from("credit_accounts").select("balance").eq("user_id", user!.id).maybeSingle()) as Pick<CreditAccount, "balance"> | null;
      return { i, credits: a?.balance ?? 0 };
    },
    [user?.id],
    !!supabase && !!user,
  );

  const receiver = profile?.primary_role === "receiver";
  const actions = [
    { href: "/donate", label: "Donate food", text: "Share surplus food.", icon: Heart },
    { href: "/find-food", label: "Find food", text: "See what's nearby.", icon: ShoppingBasket },
    { href: "/farmer-market", label: "Farmer market", text: "Buy direct from farmers.", icon: Wheat },
    { href: "/ai", label: "AI recommendations", text: "Matches and farming tips.", icon: Sparkles },
    { href: "/promote", label: "Promote", text: "Advertise with credits.", icon: Megaphone },
    { href: "/credits", label: "Credits", text: "Your balance and history.", icon: Gift },
  ];
  if (receiver) actions.unshift(actions.splice(1, 1)[0]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome${profile ? `, ${profile.display_name}` : ""}`} subtitle="Here's what's happening with your food and listings." />
      {loading ? <Skeleton className="h-28 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Food shared (collected)" value={data.i.donated_collections} hint={`${Math.round(Number(data.i.donated_kg) * 10) / 10} kg`} />
          <StatTile label="Collections received" value={data.i.received_collections} />
          <StatTile label="Active reservations" value={data.i.active_reservations} />
          <StatTile label="Credits" value={data.credits} />
          {profile?.is_farmer && <StatTile label="Active listings" value={data.i.active_listings} hint={`${data.i.open_enquiries} new enquiries`} />}
          <StatTile label="Live donations" value={data.i.live_donations} />
        </div>
      )}
      <AdSlot placement="dashboard" county={profile?.county} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => (
          <Link key={a.href} href={a.href}><Card className="flex h-full items-start gap-3 hover:border-brand-yellow"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-yellow/30"><a.icon className="h-5 w-5" /></span><div><p className="font-bold">{a.label}</p><p className="text-sm text-brand-muted">{a.text}</p></div></Card></Link>
        ))}
      </div>
      {data && data.i.live_donations === 0 && data.i.active_reservations === 0 && <LinkButton href={receiver ? "/find-food" : "/donate"}>{receiver ? "Find food near you" : "Share your first donation"}</LinkButton>}
    </div>
  );
}

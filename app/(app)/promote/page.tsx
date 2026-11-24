"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import AdCarousel from "@/components/AdCarousel";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Card, EmptyState, ErrorState, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import { AD_PLACEHOLDERS } from "@/lib/ad-placeholders";
import { formatDate } from "@/lib/format";
import type { Campaign } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

const TONE = { draft: "neutral", pending_review: "yellow", approved: "green", rejected: "red", paused: "neutral", ended: "neutral" } as const;

export default function PromotePage() {
  const { supabase, user, profile } = useAuth();
  const { data, error, loading, reload } = useAsync<Campaign[]>(
    async () => unwrap(await supabase!.from("ad_campaigns").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false })) as Campaign[],
    [user?.id],
    !!supabase && !!user,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promote & Advertise"
        subtitle="Grow your business and support the community. Sponsored placements are always labelled and reviewed before they run."
        action={<LinkButton href={profile?.is_advertiser ? "/promote/new" : "/promote/profile"}>{profile?.is_advertiser ? "Create campaign" : "Start advertising"}</LinkButton>}
      />

      <section aria-labelledby="examples" className="space-y-3">
        <h2 id="examples" className="text-xl font-bold">Example placements</h2>
        <AdCarousel slides={AD_PLACEHOLDERS} />
        <p className="text-sm text-brand-muted">Example creatives that show what a sponsored placement can look like. They are not live advertisers.</p>
      </section>

      <section aria-labelledby="mine" className="space-y-3">
        <h2 id="mine" className="text-xl font-bold">Your campaigns</h2>
        {loading ? <Skeleton className="h-32 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
          <EmptyState icon={Megaphone} title="No campaigns yet" text="Pay with promotional credits you earn by sharing food. Impressions and clicks are counted only from real signed-in viewers." action={<LinkButton href={profile?.is_advertiser ? "/promote/new" : "/promote/profile"}>Create your first campaign</LinkButton>} />
        ) : (
          <ul className="space-y-3">
            {data.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/promote/${c.id}`} className="text-lg font-bold hover:underline">{c.name}</Link>
                    <p className="text-sm text-brand-muted">{formatDate(c.start_date)} to {formatDate(c.end_date)} · {c.spent_credits}/{c.budget_credits} credits used</p>
                  </div>
                  <Badge tone={TONE[c.status]}>{c.status.replace("_", " ")}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/components/ui";
import type { LeaderRow } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

const KINDS = [
  { value: "donors", label: "Top donors", rule: "Ranked by verified collections." },
  { value: "food_saved", label: "Food saved", rule: "Ranked by kilograms collected. Items without a weight are not converted." },
  { value: "credits", label: "Credits", rule: "Ranked by credits earned. Credits under review don't count." },
  { value: "farmers", label: "Farmers", rule: "Ranked by answered enquiries (3 points each) plus active listings (1 point each)." },
  { value: "impact", label: "Community impact", rule: "Verified collections plus 2 points for each different person served." },
] as const;
type Kind = (typeof KINDS)[number]["value"];
type Period = "week" | "month" | "all";

export default function LeaderboardPage() {
  const { supabase } = useAuth();
  const [kind, setKind] = useState<Kind>("donors");
  const [period, setPeriod] = useState<Period>("month");
  const { data, error, loading, reload } = useAsync<LeaderRow[]>(
    async () => (unwrap(await supabase!.rpc("leaderboard", { p_kind: kind, p_period: period, p_limit: 25 })) as LeaderRow[]).map((r) => ({ ...r, rank: Number(r.rank), collections: Number(r.collections), credits: Number(r.credits), kg: Number(r.kg), score: Number(r.score) })),
    [kind, period],
    !!supabase,
  );
  const rule = KINDS.find((k) => k.value === kind)!.rule;

  return (
    <div className="space-y-6">
      <PageHeader title="Leaderboard" subtitle="Recognising the people and organisations who share the most. Only verified collections count. Members can opt out in Profile." />
      <Tabs label="Category" value={kind} onChange={setKind} items={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
      <Tabs label="Period" value={period} onChange={setPeriod} items={[{ value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "all", label: "All time" }]} />
      <p className="text-sm text-brand-muted">{rule}</p>
      {loading ? <Skeleton className="h-64 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={Trophy} title="No rankings yet" text="Rankings appear once food has been collected and confirmed." />
      ) : (
        <Card className="p-0">
          <ol className="divide-y divide-brand-line">
            {data.map((r) => (
              <li key={`${r.rank}-${r.display_name}`} className={`flex items-center gap-4 p-4 ${r.is_me ? "bg-brand-yellow/15" : ""}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${r.rank <= 3 ? "bg-brand-yellow" : "bg-brand-line/60"}`}>{r.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.organisation_name || r.display_name} {r.is_me && <Badge tone="yellow">You</Badge>}</p>
                  <p className="text-sm text-brand-muted">{r.county ?? "Kenya"} · {r.collections} collections{r.kg > 0 ? ` · ${Math.round(r.kg * 10) / 10} kg` : ""}</p>
                </div>
                <p className="text-lg font-bold">{Math.round(r.score * 10) / 10}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

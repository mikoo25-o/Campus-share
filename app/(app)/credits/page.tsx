"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Card, EmptyState, ErrorState, LinkButton, Notice, PageHeader, Skeleton, StatTile, Tabs } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { CreditAccount, LedgerEntry } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type Filter = "all" | "earn" | "spend" | "held";

export default function CreditsPage() {
  const { supabase, user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, loading, reload } = useAsync<{ acct: CreditAccount; rows: LedgerEntry[] }>(
    async () => {
      const acct = (unwrap(await supabase!.from("credit_accounts").select("*").eq("user_id", user!.id).maybeSingle()) as CreditAccount | null) ?? { balance: 0, total_earned: 0, total_spent: 0 };
      const rows = unwrap(await supabase!.from("credit_ledger").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(200)) as LedgerEntry[];
      return { acct, rows };
    },
    [user?.id],
    !!supabase && !!user,
  );
  const rows = (data?.rows ?? []).filter((r) => (filter === "all" ? true : filter === "held" ? r.status === "held" : filter === "earn" ? r.amount > 0 : r.amount < 0));
  const held = (data?.rows ?? []).filter((r) => r.status === "held").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Promotional credits" subtitle="Earn credits by sharing food that gets collected. Spend them on ad campaigns. Credits have no cash value and can't be withdrawn." action={<LinkButton href="/promote/new">Create campaign</LinkButton>} />
      {loading ? <Skeleton className="h-40 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Balance" value={data.acct.balance} />
            <StatTile label="Total earned" value={data.acct.total_earned} />
            <StatTile label="Total spent" value={data.acct.total_spent} />
            <StatTile label="Under review" value={held} hint="Held until checked" />
          </div>
          {held > 0 && <Notice tone="info" title="Some credits are being checked">Repeated collections between the same two people are held for review to keep the leaderboard and credits fair.</Notice>}
          <Card className="space-y-4">
            <Tabs label="Filter" value={filter} onChange={setFilter} items={[{ value: "all", label: "All" }, { value: "earn", label: "Earned" }, { value: "spend", label: "Spent" }, { value: "held", label: "Held" }]} />
            {rows.length === 0 ? <EmptyState icon={Gift} title="No credit activity yet" text="Credits are awarded when a donor confirms a collection with the receiver's code." /> : (
              <ul className="divide-y divide-brand-line">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">{r.note ?? r.entry_type}</p>
                      <p className="text-xs text-brand-muted">{formatDate(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status !== "posted" && <Badge tone={r.status === "held" ? "yellow" : "red"}>{r.status}</Badge>}
                      <span className={`font-bold ${r.amount > 0 ? "text-brand-success" : ""}`}>{r.amount > 0 ? "+" : ""}{r.amount}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

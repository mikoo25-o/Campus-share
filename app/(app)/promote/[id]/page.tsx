"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, ErrorState, Notice, PageHeader, Skeleton, SponsoredBadge, StatTile } from "@/components/ui";
import { AD_PLACEMENTS, CAMPAIGN_TYPES, labelOf } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { imageUrl } from "@/lib/storage";
import type { Campaign } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type Stats = { impressions: number; clicks: number; ctr: number; spent: number; budget: number; remaining: number };
type Day = { day: string; impressions: number; clicks: number };
const TONE = { draft: "neutral", pending_review: "yellow", approved: "green", rejected: "red", paused: "neutral", ended: "neutral" } as const;

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const { supabase } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const { data, error, loading, reload } = useAsync<{ c: Campaign; stats: Stats; days: Day[] }>(
    async () => {
      const c = unwrap(await supabase!.from("ad_campaigns").select("*").eq("id", id).maybeSingle()) as Campaign | null;
      if (!c) throw new Error("not_found");
      const stats = unwrap(await supabase!.rpc("campaign_stats", { p_campaign: id })) as Stats;
      const days = (unwrap(await supabase!.rpc("campaign_daily", { p_campaign: id, p_days: 14 })) as Day[]).map((d) => ({ ...d, impressions: Number(d.impressions), clicks: Number(d.clicks), day: d.day.slice(5) }));
      return { c, stats, days };
    },
    [id],
    !!supabase,
  );

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    setMsg(null);
    const { error: e } = await fn();
    setBusy(false);
    if (e) return setMsg({ tone: "error", text: friendlyError(e) });
    setMsg({ tone: "success", text: ok });
    await reload();
  }

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;
  if (error || !data) return <ErrorState message="We couldn't find this campaign." onRetry={reload} />;
  const { c, stats, days } = data;
  const img = imageUrl("campaign-images", c.image_path);
  const editable = c.status === "draft" || c.status === "rejected";

  return (
    <div className="space-y-6">
      <PageHeader title={c.name} subtitle={`${labelOf(CAMPAIGN_TYPES, c.campaign_type)} · ${formatDate(c.start_date)} to ${formatDate(c.end_date)}`} action={<Badge tone={TONE[c.status]}>{c.status.replace("_", " ")}</Badge>} />
      {c.status === "rejected" && <Notice tone="error" title="Not approved">{c.rejection_reason ?? "A moderator didn't approve this campaign. Your credits were returned. You can edit and resubmit."}</Notice>}
      {c.status === "pending_review" && <Notice tone="info">A moderator is reviewing this campaign. It starts running once approved.</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Impressions" value={stats.impressions.toLocaleString()} />
        <StatTile label="Clicks" value={stats.clicks.toLocaleString()} />
        <StatTile label="Click rate" value={`${stats.ctr}%`} />
        <StatTile label="Credits used" value={`${stats.spent} / ${stats.budget}`} />
        <StatTile label="Credits left" value={stats.remaining} />
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Last 14 days</h2>
        {stats.impressions === 0 && stats.clicks === 0 ? (
          <p className="text-sm text-brand-muted">No views yet. Counts only include real, signed-in viewers, once the campaign is approved and live.</p>
        ) : (
          <div className="h-64 w-full" role="img" aria-label="Daily impressions and clicks">
            <ResponsiveContainer>
              <ComposedChart data={days}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                <Tooltip />
                <Bar dataKey="impressions" name="Impressions" fill="#124D2D" radius={[4, 4, 0, 0]} />
                <Line dataKey="clicks" name="Clicks" stroke="#F5B719" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Your ad</h2>
        {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="aspect-[16/7] w-full rounded-2xl object-cover" />}
        <SponsoredBadge />
        <p className="text-lg font-bold">{c.headline}</p>
        {c.description && <p className="text-sm text-brand-muted">{c.description}</p>}
        <p className="break-all text-sm text-brand-muted">Sends to: {c.destination_url}</p>
        <p className="text-sm text-brand-muted">Shown in: {c.placements.map((p) => labelOf(AD_PLACEMENTS, p)).join(", ")}{c.target_counties.length ? ` · ${c.target_counties.join(", ")}` : " · all counties"}</p>
      </Card>

      <div className="flex flex-wrap gap-3">
        {editable && <Button loading={busy} onClick={() => void act(() => supabase!.rpc("submit_campaign", { p_campaign: id }), "Submitted for review.")}>Submit for review</Button>}
        {c.status === "approved" && <Button variant="secondary" loading={busy} onClick={() => void act(() => supabase!.rpc("set_campaign_paused", { p_campaign: id, p_paused: true }), "Campaign paused.")}>Pause</Button>}
        {c.status === "paused" && <Button loading={busy} onClick={() => void act(() => supabase!.rpc("set_campaign_paused", { p_campaign: id, p_paused: false }), "Campaign resumed.")}>Resume</Button>}
        {["approved", "paused"].includes(c.status) && <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm("End this campaign now? Unspent credits are returned.")) void act(() => supabase!.rpc("end_campaign", { p_campaign: id }), "Campaign ended and unspent credits returned."); }}>End and refund</Button>}
        {c.status === "draft" && <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Delete this draft?")) void act(() => supabase!.from("ad_campaigns").delete().eq("id", id), "Deleted."); }}>Delete draft</Button>}
      </div>
    </div>
  );
}

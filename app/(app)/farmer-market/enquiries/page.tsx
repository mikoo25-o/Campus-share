"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, EmptyState, ErrorState, Notice, PageHeader, Skeleton, Tabs, TextArea } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import type { Enquiry } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

export default function EnquiriesPage() {
  const { supabase, user } = useAuth();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const { data, error, loading, reload } = useAsync<Enquiry[]>(
    async () => unwrap(await supabase!.from("product_enquiries").select("*, produce_listings(name)").or(`farmer_id.eq.${user!.id},buyer_id.eq.${user!.id}`).order("created_at", { ascending: false }).limit(100)) as Enquiry[],
    [user?.id],
    !!supabase && !!user,
  );
  const list = (data ?? []).filter((e) => (tab === "received" ? e.farmer_id === user?.id : e.buyer_id === user?.id));
  return (
    <div className="space-y-6">
      <PageHeader title="Enquiries" subtitle="Messages about produce. Agree price and handover directly with each other." />
      <Tabs label="Enquiries" value={tab} onChange={setTab} items={[{ value: "received", label: "Received" }, { value: "sent", label: "Sent" }]} />
      {loading ? <Skeleton className="h-40 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : list.length === 0 ? (
        <EmptyState icon={MessageSquare} title={tab === "received" ? "No enquiries yet" : "You haven't sent any enquiries"} />
      ) : (
        <ul className="space-y-3">{list.map((e) => <li key={e.id}><EnquiryCard e={e} mine={e.farmer_id === user?.id} onChange={reload} /></li>)}</ul>
      )}
    </div>
  );
}

function EnquiryCard({ e, mine, onChange }: { e: Enquiry; mine: boolean; onChange: () => void }) {
  const { supabase } = useAuth();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    if (!supabase) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("reply_enquiry", { p_enquiry: e.id, p_reply: reply });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    onChange();
  }
  async function close() {
    if (!supabase) return;
    await supabase.rpc("close_enquiry", { p_enquiry: e.id });
    onChange();
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/farmer-market/${e.listing_id}`} className="font-bold hover:underline">{e.produce_listings?.name ?? "Produce"}</Link>
        <Badge tone={e.status === "new" ? "yellow" : e.status === "replied" ? "green" : "neutral"}>{e.status}</Badge>
      </div>
      <p className="whitespace-pre-wrap">{e.message}</p>
      <p className="text-xs text-brand-muted">{timeAgo(e.created_at)}{e.quantity_interest ? ` · interested in ${e.quantity_interest}` : ""}</p>
      {e.reply && <div className="rounded-2xl bg-brand-yellow/15 p-3 text-sm"><p className="font-semibold">Farmer&apos;s reply</p><p className="whitespace-pre-wrap">{e.reply}</p></div>}
      {mine && e.status === "new" && (
        <div className="space-y-2">
          <TextArea label="Your reply" value={reply} maxLength={1000} onChange={(x) => setReply(x.target.value)} />
          {err && <Notice tone="error">{err}</Notice>}
          <Button loading={busy} onClick={() => void send()}>Send reply</Button>
        </div>
      )}
      {e.status !== "closed" && <Button variant="ghost" onClick={() => void close()}>Close enquiry</Button>}
    </Card>
  );
}

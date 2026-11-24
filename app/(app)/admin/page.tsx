"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, EmptyState, ErrorState, Notice, PageHeader, Skeleton, StatTile, Tabs, TextInput } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatDate, timeAgo } from "@/lib/format";
import type { Campaign, LedgerEntry } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type Tab = "reports" | "campaigns" | "credits" | "settings" | "members";
type Overview = { open_reports: number; pending_campaigns: number; held_credits: number; live_donations: number; active_listings: number; members: number; suspended: number };
type Report = { id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string };
type Setting = { key: string; value: unknown; description: string };
type Member = { id: string; display_name: string; organisation_name: string | null; county: string | null; status: string; is_admin: boolean; created_at: string };

export default function AdminPage() {
  const { profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("reports");
  if (loading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!profile?.is_admin) return <EmptyState title="Administrators only" text="You don't have access to this area." />;
  return (
    <div className="space-y-6">
      <PageHeader title="Administration" subtitle="Moderation and platform settings. Every action is recorded." />
      <Overview />
      <Tabs label="Admin sections" value={tab} onChange={setTab} items={[{ value: "reports", label: "Reports" }, { value: "campaigns", label: "Campaigns" }, { value: "credits", label: "Held credits" }, { value: "settings", label: "Settings" }, { value: "members", label: "Members" }]} />
      {tab === "reports" && <Reports />}
      {tab === "campaigns" && <Campaigns />}
      {tab === "credits" && <Credits />}
      {tab === "settings" && <Settings />}
      {tab === "members" && <Members />}
    </div>
  );
}

function Overview() {
  const { supabase } = useAuth();
  const { data } = useAsync<Overview>(async () => unwrap(await supabase!.rpc("admin_overview")) as Overview, [], !!supabase);
  if (!data) return <Skeleton className="h-24 rounded-3xl" />;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Open reports" value={data.open_reports} />
      <StatTile label="Campaigns to review" value={data.pending_campaigns} />
      <StatTile label="Held credits" value={data.held_credits} />
      <StatTile label="Members" value={data.members} hint={`${data.suspended} suspended`} />
      <StatTile label="Live donations" value={data.live_donations} />
      <StatTile label="Active listings" value={data.active_listings} />
    </div>
  );
}

function useAct(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: friendlyError(error) });
    setMsg({ tone: "success", text: ok });
    reload();
  }
  return { busy, msg, act };
}

function Reports() {
  const { supabase } = useAuth();
  const { data, error, loading, reload } = useAsync<Report[]>(async () => unwrap(await supabase!.from("reports").select("*").eq("status", "open").order("created_at").limit(50)) as Report[], [], !!supabase);
  const { busy, msg, act } = useAct(reload);
  const [note, setNote] = useState("");
  if (loading) return <Skeleton className="h-32 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!data?.length ? <EmptyState title="No open reports" /> : (
        <>
          <TextInput label="Note for the next action (shown to the owner on removal)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          {data.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="red">{r.reason.replace("_", " ")}</Badge><Badge>{r.target_type}</Badge><span className="text-xs text-brand-muted">{timeAgo(r.created_at)}</span></div>
              {r.details && <p className="text-sm">{r.details}</p>}
              <p className="break-all text-xs text-brand-muted">Target: {r.target_type} {r.target_id}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => void act(() => supabase!.rpc("admin_resolve_report", { p_report: r.id, p_action: "dismiss", p_note: note || null }), "Dismissed.")}>Dismiss</Button>
                <Button variant="danger" disabled={busy} onClick={() => void act(() => supabase!.rpc("admin_resolve_report", { p_report: r.id, p_action: "remove_content", p_note: note || null }), "Content removed.")}>Remove content</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Suspend the owner of this content?")) void act(() => supabase!.rpc("admin_resolve_report", { p_report: r.id, p_action: "suspend_user", p_note: note || null }), "User suspended."); }}>Suspend owner</Button>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function Campaigns() {
  const { supabase } = useAuth();
  const { data, error, loading, reload } = useAsync<Campaign[]>(async () => unwrap(await supabase!.from("ad_campaigns").select("*").eq("status", "pending_review").order("created_at")) as Campaign[], [], !!supabase);
  const { busy, msg, act } = useAct(reload);
  const [reason, setReason] = useState("");
  if (loading) return <Skeleton className="h-32 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!data?.length ? <EmptyState title="No campaigns waiting" /> : (
        <>
          <TextInput label="Reason (required to reject)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          {data.map((c) => (
            <Card key={c.id} className="space-y-2">
              <p className="text-lg font-bold">{c.headline}</p>
              <p className="text-sm text-brand-muted">{c.name} · {formatDate(c.start_date)} to {formatDate(c.end_date)} · {c.budget_credits} credits</p>
              {c.description && <p className="text-sm">{c.description}</p>}
              <p className="break-all text-sm">Link: <a className="underline" href={c.destination_url} target="_blank" rel="noopener noreferrer nofollow">{c.destination_url}</a></p>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void act(() => supabase!.rpc("admin_review_campaign", { p_campaign: c.id, p_approve: true, p_reason: null }), "Approved.")}>Approve</Button>
                <Button variant="danger" disabled={busy || reason.trim().length < 3} onClick={() => void act(() => supabase!.rpc("admin_review_campaign", { p_campaign: c.id, p_approve: false, p_reason: reason.trim() }), "Rejected and credits returned.")}>Reject</Button>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function Credits() {
  const { supabase } = useAuth();
  const { data, error, loading, reload } = useAsync<LedgerEntry[]>(async () => unwrap(await supabase!.from("credit_ledger").select("*").eq("status", "held").order("created_at")) as LedgerEntry[], [], !!supabase);
  const { busy, msg, act } = useAct(reload);
  if (loading) return <Skeleton className="h-32 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!data?.length ? <EmptyState title="No held credits" text="Repeated collections between the same two people are held here for review." /> : data.map((l) => (
        <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-bold">+{l.amount} credits</p><p className="text-sm text-brand-muted">{l.note} · {timeAgo(l.created_at)}</p></div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void act(() => supabase!.rpc("admin_release_credit", { p_ledger: l.id, p_release: true }), "Released.")}>Release</Button>
            <Button variant="danger" disabled={busy} onClick={() => void act(() => supabase!.rpc("admin_release_credit", { p_ledger: l.id, p_release: false }), "Reversed.")}>Reverse</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Settings() {
  const { supabase } = useAuth();
  const { data, error, loading, reload } = useAsync<Setting[]>(async () => unwrap(await supabase!.from("platform_settings").select("*").order("key")) as Setting[], [], !!supabase);
  const { busy, msg, act } = useAct(reload);
  const [edits, setEdits] = useState<Record<string, string>>({});
  if (loading) return <Skeleton className="h-32 rounded-3xl" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {(data ?? []).map((s) => {
        const current = edits[s.key] ?? JSON.stringify(s.value);
        return (
          <Card key={s.key} className="space-y-2">
            <p className="font-bold">{s.key}</p>
            <p className="text-sm text-brand-muted">{s.description}</p>
            <div className="flex items-end gap-2">
              <div className="flex-1"><TextInput label="Value" value={current} onChange={(e) => setEdits((p) => ({ ...p, [s.key]: e.target.value }))} /></div>
              <Button disabled={busy || current === JSON.stringify(s.value)} onClick={() => {
                let parsed: unknown;
                try { parsed = JSON.parse(current); } catch { return alert("Use a number, true/false or a JSON value."); }
                void act(() => supabase!.rpc("admin_set_setting", { p_key: s.key, p_value: parsed }), "Saved.");
              }}>Save</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Members() {
  const { supabase } = useAuth();
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useAsync<Member[]>(async () => {
    let query = supabase!.from("profiles").select("id, display_name, organisation_name, county, status, is_admin, created_at").order("created_at", { ascending: false }).limit(50);
    if (q.trim().length >= 2) query = query.ilike("display_name", `%${q.trim().replace(/[%_]/g, "")}%`);
    return unwrap(await query) as Member[];
  }, [q], !!supabase);
  const { busy, msg, act } = useAct(reload);
  return (
    <div className="space-y-3">
      <TextInput label="Search by display name" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {loading ? <Skeleton className="h-32 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : (data ?? []).map((m) => (
        <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-bold">{m.display_name} {m.is_admin && <Badge tone="blue">admin</Badge>}</p><p className="text-sm text-brand-muted">{m.organisation_name ? `${m.organisation_name} · ` : ""}{m.county ?? "No county"} · joined {formatDate(m.created_at)}</p></div>
          <div className="flex items-center gap-2">
            <Badge tone={m.status === "active" ? "green" : "red"}>{m.status}</Badge>
            {!m.is_admin && (m.status === "active"
              ? <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm(`Suspend ${m.display_name}?`)) void act(() => supabase!.rpc("admin_set_user_status", { p_user: m.id, p_status: "suspended", p_note: "Suspended by moderator" }), "Suspended."); }}>Suspend</Button>
              : <Button variant="secondary" disabled={busy} onClick={() => void act(() => supabase!.rpc("admin_set_user_status", { p_user: m.id, p_status: "active", p_note: null }), "Reinstated.")}>Reinstate</Button>)}
          </div>
        </Card>
      ))}
    </div>
  );
}

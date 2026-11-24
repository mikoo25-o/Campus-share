"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, Gift, Heart } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Notice, PageHeader, Skeleton, Tabs, TextInput } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatDeadline, formatQty, timeAgo } from "@/lib/format";
import type { Donation, Reservation } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

type DonationRow = Donation & { food_reservations: Reservation[] };
type Data = { mine: Reservation[]; donations: DonationRow[]; names: Record<string, string> };

const STATUS_TONE = { reserved: "yellow", collected: "green", cancelled: "red", expired: "red" } as const;
const DON_TONE: Record<string, "yellow" | "green" | "red" | "neutral"> = { available: "green", reserved: "yellow", collected: "green", expired: "red", cancelled: "red", draft: "neutral" };

export default function ActivityPage() {
  const { supabase, user } = useAuth();
  const [tab, setTab] = useState<"collecting" | "sharing">("collecting");
  const { data, error, loading, reload } = useAsync<Data>(
    async () => {
      const mine = unwrap(
        await supabase!.from("food_reservations").select("*, food_donations(id, title, unit, county, town, expires_at, status)").eq("receiver_id", user!.id).order("created_at", { ascending: false }).limit(100),
      ) as Reservation[];
      const donations = unwrap(
        await supabase!.from("food_donations").select("*, food_reservations(*)").eq("donor_id", user!.id).order("created_at", { ascending: false }).limit(100),
      ) as DonationRow[];
      const ids = Array.from(new Set(donations.flatMap((d) => d.food_reservations.map((r) => r.receiver_id))));
      const names: Record<string, string> = {};
      if (ids.length) {
        const rows = unwrap(await supabase!.from("public_profiles").select("id, display_name").in("id", ids)) as { id: string; display_name: string }[];
        rows.forEach((r) => (names[r.id] = r.display_name));
      }
      return { mine, donations, names };
    },
    [user?.id],
    !!supabase && !!user,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="My activity" subtitle="Food you are collecting and food you are sharing." />
      <Tabs label="Activity" value={tab} onChange={setTab} items={[{ value: "collecting", label: "Collecting", icon: Gift }, { value: "sharing", label: "Sharing", icon: Heart }]} />

      {loading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? null : tab === "collecting" ? (
        data.mine.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing reserved yet" text="When you reserve food, your handover code and pickup address appear here." action={<LinkButton href="/find-food">Find food</LinkButton>} />
        ) : (
          <ul className="space-y-3">
            {data.mine.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/find-food/${r.donation_id}`} className="text-lg font-bold hover:underline">{r.food_donations?.title ?? "Food"}</Link>
                    <p className="text-sm text-brand-muted">
                      {formatQty(r.quantity, r.food_donations?.unit ?? "")} · {r.food_donations?.town}, {r.food_donations?.county}
                    </p>
                    <p className="text-sm text-brand-muted">
                      {r.status === "reserved" && r.food_donations ? `Collect by ${formatDeadline(r.food_donations.expires_at)}` : `Reserved ${timeAgo(r.created_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    {r.status === "reserved" && <LinkButton href={`/find-food/${r.donation_id}`} variant="secondary">Code and address</LinkButton>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : data.donations.length === 0 ? (
        <EmptyState icon={Heart} title="You haven't shared food yet" text="Post surplus food and it will show up here, along with who reserved it." action={<LinkButton href="/donate">Donate food</LinkButton>} />
      ) : (
        <ul className="space-y-3">
          {data.donations.map((d) => (
            <li key={d.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/find-food/${d.id}`} className="text-lg font-bold hover:underline">{d.title}</Link>
                    <p className="text-sm text-brand-muted">{formatQty(d.quantity_remaining, d.unit)} of {formatQty(d.quantity, d.unit)} left · collect by {formatDeadline(d.expires_at)}</p>
                  </div>
                  <Badge tone={DON_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
                </div>
                {d.food_reservations.filter((r) => r.status === "reserved").map((r) => (
                  <ConfirmRow key={r.id} r={r} unit={d.unit} name={data.names[r.receiver_id] ?? "A receiver"} onDone={reload} />
                ))}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfirmRow({ r, unit, name, onDone }: { r: Reservation; unit: string; name: string; onDone: () => void }) {
  const { supabase } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const locked = r.code_attempts >= 5;

  async function confirm() {
    if (!supabase) return;
    if (!/^\d{6}$/.test(code.trim())) return setMsg({ tone: "error", text: "The code has 6 digits." });
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("confirm_collection", { p_reservation: r.id, p_code: code.trim() });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: friendlyError(error) });
    const res = data as { ok: boolean; reason?: string; attempts_left?: number };
    if (res.ok) {
      setMsg({ tone: "success", text: "Collection confirmed. Thank you for sharing." });
      onDone();
    } else if (res.reason === "locked") setMsg({ tone: "error", text: "Too many wrong codes. Ask the receiver to cancel and reserve again, or contact support." });
    else setMsg({ tone: "error", text: `That code is not right. ${res.attempts_left ?? 0} attempts left.` });
    if (!res.ok) onDone();
  }

  async function cancel() {
    if (!supabase || !window.confirm("Cancel this reservation? The food becomes available again.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_reservation", { p_reservation: r.id });
    setBusy(false);
    if (error) setMsg({ tone: "error", text: friendlyError(error) });
    else onDone();
  }

  return (
    <div className="space-y-3 rounded-2xl bg-brand-line/40 p-4">
      <p className="text-sm"><strong>{name}</strong> reserved {formatQty(r.quantity, unit)} · {timeAgo(r.created_at)}</p>
      {locked ? (
        <Notice tone="error">Too many wrong codes. This reservation is locked.</Notice>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <TextInput label="Receiver's 6-digit code" inputMode="numeric" maxLength={6} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button loading={busy} onClick={() => void confirm()}>Confirm collection</Button>
          <Button variant="ghost" disabled={busy} onClick={() => void cancel()}>Cancel</Button>
        </div>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

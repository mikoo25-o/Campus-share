"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { unwrap, useAsync } from "@/lib/useAsync";

export default function NotificationsPage() {
  const { supabase, user } = useAuth();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const { data, error, loading, reload } = useAsync<AppNotification[]>(
    async () => unwrap(await supabase!.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100)) as AppNotification[],
    [user?.id],
    !!supabase && !!user,
  );
  const list = (data ?? []).filter((n) => tab === "all" || !n.read_at);
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  async function markAll() {
    await supabase?.rpc("mark_all_notifications_read");
    await reload();
  }
  async function markOne(id: string) {
    await supabase?.rpc("mark_notifications_read", { p_ids: [id] });
    await reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" action={unread > 0 ? <Button variant="secondary" onClick={() => void markAll()}><CheckCheck className="h-4 w-4" aria-hidden="true" />Mark all read</Button> : undefined} />
      <Tabs label="Filter" value={tab} onChange={setTab} items={[{ value: "all", label: "All" }, { value: "unread", label: `Unread (${unread})` }]} />
      {loading ? <Skeleton className="h-40 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : list.length === 0 ? (
        <EmptyState icon={Bell} title={tab === "unread" ? "You're all caught up" : "No notifications yet"} text="Reservations, collections, enquiries and campaign updates show up here." />
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <Card className={`flex items-start justify-between gap-3 ${n.read_at ? "" : "border-brand-yellow bg-brand-yellow/10"}`}>
                <div>
                  <p className="font-bold">{n.title}</p>
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-brand-muted">{timeAgo(n.created_at)}</p>
                  {n.link && <Link href={n.link} onClick={() => !n.read_at && void markOne(n.id)} className="mt-1 inline-block text-sm font-semibold underline">Open</Link>}
                </div>
                {!n.read_at && <Button variant="ghost" onClick={() => void markOne(n.id)}>Mark read</Button>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

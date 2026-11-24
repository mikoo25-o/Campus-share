"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, TextInput } from "@/components/ui";
import { unwrap, useAsync } from "@/lib/useAsync";

type Hit = { kind: string; id: string; title: string; subtitle: string; county: string; link: string };
const LABEL: Record<string, string> = { food: "Food", produce: "Produce", farmer: "Farmer", campaign: "Sponsored" };

function SearchInner() {
  const { supabase } = useAuth();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [term, setTerm] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useAsync<Hit[]>(async () => unwrap(await supabase!.rpc("search_all", { p_q: term, p_limit: 30 })) as Hit[], [term], !!supabase && term.length >= 2);

  return (
    <div className="space-y-6">
      <PageHeader title="Search" subtitle="Find food, produce and farmers." />
      <TextInput label="Search" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Maize, bread, Kisii..." />
      {term.length < 2 ? <EmptyState icon={Search} title="Type at least 2 letters" /> : loading ? <Skeleton className="h-40 rounded-3xl" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={Search} title={`Nothing found for “${term}”`} text="Try a different word, or browse Find Food and the Farmer Market." />
      ) : (
        <ul className="space-y-2">
          {data.map((h) => (
            <li key={`${h.kind}-${h.id}`}>
              <Link href={h.link}><Card className="flex items-center justify-between gap-3 hover:border-brand-yellow"><div><p className="font-bold">{h.title}</p><p className="text-sm text-brand-muted">{h.subtitle}</p></div><Badge>{LABEL[h.kind] ?? h.kind}</Badge></Card></Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<Skeleton className="h-40 rounded-3xl" />}><SearchInner /></Suspense>;
}

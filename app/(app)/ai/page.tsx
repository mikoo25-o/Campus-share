"use client";

import Link from "next/link";
import { useState } from "react";
import { CloudSun, Sparkles, Utensils } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, EmptyState, Notice, PageHeader, SelectInput, Tabs, TextInput } from "@/components/ui";
import { COUNTIES, COUNTY_CENTRES } from "@/lib/constants";

type Pick = { id: string; title: string; county: string; reason: string; source: string };
type Climate = { county: string; rainTotal: number; advice: string[]; source: string; weather: { days: { date: string; max: number; min: number; rain: number }[] } };

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json as T;
}

export default function AiPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"match" | "climate" | "impact">("match");
  return (
    <div className="space-y-6">
      <PageHeader title="AI recommendations" subtitle="Suggestions to save you time. They are guidance only: always check food and farming advice yourself." />
      <Tabs label="Assistant" value={tab} onChange={setTab} items={[{ value: "match", label: "Food for you", icon: Utensils }, { value: "climate", label: "Climate-smart farming", icon: CloudSun }, { value: "impact", label: "My impact", icon: Sparkles }]} />
      {tab === "match" && <Match />}
      {tab === "climate" && <ClimateTab defaultCounty={profile?.county ?? ""} />}
      {tab === "impact" && <Impact />}
    </div>
  );
}

function Match() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ picks: Pick[]; total: number } | null>(null);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true); setError("");
    try { setData(await post("/api/ai/match")); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-muted">Matches available food to your county and dietary needs (set in <Link href="/profile" className="underline">Profile</Link>). Food with allergens you didn&apos;t rule out is flagged, never hidden.</p>
      <Button loading={busy} onClick={() => void run()}>Find my matches</Button>
      {error && <Notice tone="error">{error}</Notice>}
      {data && (data.picks.length === 0 ? <EmptyState title="No matches right now" text={data.total === 0 ? "There is no food available at the moment." : "Nothing fits your preferences yet. Try widening them in Profile."} /> : (
        <ul className="space-y-2">
          {data.picks.map((p) => (
            <li key={p.id}><Link href={`/find-food/${p.id}`}><Card className="hover:border-brand-yellow"><p className="font-bold">{p.title}</p><p className="text-sm text-brand-muted">{p.county} · {p.reason}</p></Card></Link></li>
          ))}
          <li className="text-xs text-brand-muted">{data.picks[0]?.source === "gemini" ? "Ranked by AI, checked against your dietary needs." : "Ranked by simple rules (AI is not connected)."}</li>
        </ul>
      ))}
    </div>
  );
}

function ClimateTab({ defaultCounty }: { defaultCounty: string }) {
  const [county, setCounty] = useState(defaultCounty);
  const [crop, setCrop] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Climate | null>(null);
  const [error, setError] = useState("");
  async function run() {
    if (!county) return setError("Choose a county.");
    setBusy(true); setError("");
    try { setData(await post("/api/ai/climate", { county, crop })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-muted">Real 7-day forecast from Open-Meteo, turned into general tips. This is not a replacement for your local agricultural extension officer.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="County" value={county} onChange={(e) => setCounty(e.target.value)} options={COUNTIES.filter((c) => COUNTY_CENTRES[c]).map((c) => ({ value: c, label: c }))} placeholder="Choose a county" />
        <TextInput label="Crop (optional)" value={crop} maxLength={60} onChange={(e) => setCrop(e.target.value)} placeholder="Maize, tomatoes..." />
      </div>
      <Button loading={busy} onClick={() => void run()}>Get advice</Button>
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 text-lg font-bold">7-day forecast for {data.county}</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="text-left text-brand-muted"><th className="py-1">Day</th><th>High</th><th>Low</th><th>Rain</th></tr></thead><tbody>{data.weather.days.map((d) => <tr key={d.date} className="border-t border-brand-line"><td className="py-1.5">{new Date(d.date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</td><td>{d.max}°C</td><td>{d.min}°C</td><td>{d.rain} mm</td></tr>)}</tbody></table></div>
          </Card>
          <Card><h2 className="mb-2 text-lg font-bold">Tips</h2><ul className="list-disc space-y-1.5 pl-5">{data.advice.map((a) => <li key={a}>{a}</li>)}</ul><p className="mt-3 text-xs text-brand-muted">{data.source === "gemini" ? "Written by AI from the forecast above. General guidance only." : "Rule-based tips from the forecast (AI is not connected)."}</p></Card>
        </div>
      )}
    </div>
  );
}

function Impact() {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  async function run() {
    setBusy(true); setError("");
    try { setText((await post<{ summary: string }>("/api/ai/impact")).summary); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-muted">A short summary written from your own verified numbers.</p>
      <Button loading={busy} onClick={() => void run()}>Summarise my impact</Button>
      {error && <Notice tone="error">{error}</Notice>}
      {text && <Card><p>{text}</p></Card>}
    </div>
  );
}

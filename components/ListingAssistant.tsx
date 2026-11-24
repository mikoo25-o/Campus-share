"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Notice } from "./ui";

export type ListingSuggestion = { description?: string; keywords?: string[] };

/** Asks the server for a better description and keywords. Always optional; the farmer decides what to keep. */
export default function ListingAssistant({ name, category, description, county, onApply }: { name: string; category: string; description: string; county: string; onApply: (s: ListingSuggestion) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(ListingSuggestion & { source?: string }) | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (name.trim().length < 3) return setError("Add the produce name first.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/listing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category, description, county }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "The assistant isn't available right now. You can still write your own description.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-brand-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Need help writing? <span className="font-normal text-brand-muted">AI can suggest a description and keywords.</span></p>
        <Button variant="secondary" loading={busy} onClick={() => void run()}><Sparkles className="h-4 w-4" aria-hidden="true" />Suggest</Button>
      </div>
      {error && <Notice tone="warn">{error}</Notice>}
      {result && (
        <div className="space-y-2 text-sm">
          {result.description && <p className="rounded-xl bg-brand-line/40 p-3">{result.description}</p>}
          {result.keywords && <p className="text-brand-muted">Keywords: {result.keywords.join(", ")}</p>}
          <p className="text-xs text-brand-muted">{result.source === "gemini" ? "Suggested by AI. Check it is accurate before using." : "Template suggestion (AI is not connected). Check it before using."}</p>
          <div className="flex gap-2">
            <Button onClick={() => { onApply(result); setResult(null); }}>Use this</Button>
            <Button variant="ghost" onClick={() => setResult(null)}>Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  );
}

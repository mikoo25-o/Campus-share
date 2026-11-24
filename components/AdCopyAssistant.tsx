"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Notice } from "./ui";

/** Suggests ad copy. The advertiser always decides what is used; nothing is submitted automatically. */
export default function AdCopyAssistant({ business, type, headline, description, onApply }: { business: string; type: string; headline: string; description: string; onApply: (headline: string, description: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<{ headline: string; description: string }[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/ad-copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business, type, headline, description }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setOptions(json.options);
      setSource(json.source);
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "The assistant isn't available right now. You can still write your own copy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-brand-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Stuck on wording? <span className="font-normal text-brand-muted">Get a few honest, clear options.</span></p>
        <Button variant="secondary" loading={busy} onClick={() => void run()}><Sparkles className="h-4 w-4" aria-hidden="true" />Suggest copy</Button>
      </div>
      {error && <Notice tone="warn">{error}</Notice>}
      {options.length > 0 && (
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={i} className="rounded-xl bg-brand-line/40 p-3 text-sm">
              <p className="font-bold">{o.headline}</p>
              <p className="text-brand-muted">{o.description}</p>
              <Button variant="ghost" className="mt-1" onClick={() => { onApply(o.headline, o.description); setOptions([]); }}>Use this</Button>
            </li>
          ))}
          <li className="text-xs text-brand-muted">{source === "gemini" ? "Suggested by AI. Make sure every claim is true before you submit." : "Template suggestions (AI is not connected). Edit them to fit your business."}</li>
        </ul>
      )}
    </div>
  );
}

import { supabaseConfigured } from "@/lib/supabase/client";

/** Shown on auth pages until the Supabase keys are added, so nothing pretends to work. */
export default function SupabaseNotice() {
  if (supabaseConfigured) return null;
  return (
    <div role="status" className="rounded-2xl border border-brand-gold bg-brand-yellow/20 p-4 text-sm">
      <p className="font-semibold">Accounts are not connected yet</p>
      <p className="mt-1 text-brand-muted">
        Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="font-mono text-xs">.env.local</code> and restart the dev server. The form
        is disabled until then.
      </p>
    </div>
  );
}

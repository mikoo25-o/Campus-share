"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import FormField from "./FormField";
import SupabaseNotice from "./SupabaseNotice";
import { Notice } from "./ui";
import { getSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (authError) {
      setError(
        authError.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : authError.message?.toLowerCase().includes("confirm")
            ? "Please verify your email first. Check your inbox for the link we sent."
            : "Email or password is incorrect.",
      );
      return;
    }
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    router.push(safe);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <SupabaseNotice />
      {linkError && <Notice tone="error">That link is invalid or has expired. Request a new one below.</Notice>}
      <FormField id="email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" required />
      <FormField id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-gold underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-brand-alert bg-brand-alert/10 p-3 text-sm font-medium text-brand-alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!supabaseConfigured || submitting}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-8 py-3 text-base font-bold text-brand-ink hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Logging in..." : "Log in"}
        {!submitting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
      </button>

      <p className="text-center text-sm text-brand-muted">
        New to CampusShare?{" "}
        <Link href="/get-started" className="font-semibold text-brand-gold underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

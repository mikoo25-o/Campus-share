"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import FormField from "./FormField";
import SupabaseNotice from "./SupabaseNotice";
import { Button } from "./ui";
import { useAuth } from "./AuthProvider";
import { supabaseConfigured } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

export function ForgotPasswordForm() {
  const { supabase } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setBusy(false);
    // Same message either way, so this form can't be used to find out who has an account.
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="space-y-3 rounded-3xl border border-brand-line bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand-success" aria-hidden="true" />
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-brand-muted">If an account exists for that address, we&apos;ve sent a link to reset your password.</p>
        <Link href="/login" className="text-sm font-semibold text-brand-gold underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <SupabaseNotice />
      <FormField id="email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />
      {error && <p role="alert" className="text-sm font-medium text-brand-alert">{error}</p>}
      <Button type="submit" loading={busy} disabled={!supabaseConfigured} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { supabase, user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyError(err, "We couldn't change your password. Request a new link and try again."));
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="space-y-3 rounded-3xl border border-brand-line bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand-success" aria-hidden="true" />
        <h2 className="text-xl font-bold">Password changed</h2>
        <Link href="/dashboard" className="inline-flex min-h-[44px] items-center rounded-full bg-brand-yellow px-6 font-bold">
          Continue
        </Link>
      </div>
    );
  }
  if (!loading && !user) {
    return (
      <p role="alert" className="rounded-2xl border border-brand-alert/50 bg-brand-alert/10 p-4 text-sm">
        This link has expired. <Link href="/forgot-password" className="font-semibold underline">Request a new one</Link>.
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField id="password" label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." required />
      <FormField id="confirm" label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
      {error && <p role="alert" className="text-sm font-medium text-brand-alert">{error}</p>}
      <Button type="submit" loading={busy} className="w-full">
        Change password
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, HandHeart, ShoppingBasket } from "lucide-react";
import FormField from "./FormField";
import SupabaseNotice from "./SupabaseNotice";
import { getSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase/client";
import { ROLES, type Role } from "@/lib/roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ICONS = { donor: HandHeart, receiver: ShoppingBasket } as const;

type Errors = Partial<
  Record<"firstName" | "lastName" | "email" | "password" | "confirm" | "terms", string>
>;

export default function SignUpForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = "Enter your first name.";
    if (!lastName.trim()) next.lastName = "Enter your last name.";
    if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (confirm !== password) next.confirm = "Passwords do not match.";
    if (!terms) next.terms = "You need to agree to continue.";
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        // This is only a request. The database must validate the role when it creates the
        // profile; never trust this value for permissions on its own.
        data: { first_name: firstName.trim(), last_name: lastName.trim(), primary_role: role },
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(
        error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : "We couldn't create your account. Check your details and try again.",
      );
      return;
    }
    // Same message whether or not the email already exists, so the form doesn't reveal who has an account.
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="space-y-4 rounded-3xl border border-brand-line bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand-success" aria-hidden="true" />
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="text-brand-muted">
          If this address can be used, we&apos;ve sent a link to verify your account. Open it, then
          log in.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-yellow px-8 py-3 font-bold text-brand-ink hover:bg-brand-gold"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  const disabled = !supabaseConfigured || submitting;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <SupabaseNotice />

      <div role="radiogroup" aria-label="Your role" className="grid grid-cols-2 gap-3">
        {ROLES.map((r) => {
          const Icon = ICONS[r.value];
          const selected = role === r.value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setRole(r.value)}
              className={`flex min-h-[72px] items-center gap-3 rounded-2xl border-2 p-3 text-left ${
                selected ? "border-brand-yellow bg-brand-yellow" : "border-brand-line bg-white"
              }`}
            >
              <Icon className="h-7 w-7 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-bold">{r.value === "donor" ? "Donor" : "Receiver"}</span>
                <span className="block text-xs">
                  {r.value === "donor" ? "I have food to share" : "I want to collect food"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="firstName" label="First name" value={firstName} onChange={setFirstName} error={errors.firstName} autoComplete="given-name" required />
        <FormField id="lastName" label="Last name" value={lastName} onChange={setLastName} error={errors.lastName} autoComplete="family-name" required />
      </div>
      <FormField id="email" label="Email address" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" placeholder="you@example.com" required />
      <FormField id="password" label="Password" type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" hint="At least 8 characters." required />
      <FormField id="confirm" label="Confirm password" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" required />

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "terms-error" : undefined}
            className="mt-0.5 h-6 w-6 shrink-0 rounded border-brand-line accent-brand-gold"
          />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {errors.terms && (
          <p id="terms-error" role="alert" className="mt-1 text-sm font-medium text-brand-alert">
            {errors.terms}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-2xl border border-brand-alert bg-brand-alert/10 p-3 text-sm font-medium text-brand-alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-8 py-3 text-base font-bold text-brand-ink hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating account..." : "Create Account"}
        {!submitting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
      </button>

      <p className="text-center text-sm text-brand-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-gold underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

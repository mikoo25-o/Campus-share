"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-yellow text-brand-ink hover:bg-brand-gold",
  secondary: "border border-brand-line bg-white text-brand-ink hover:bg-brand-line/50",
  ghost: "text-brand-ink hover:bg-brand-line/60",
  danger: "bg-brand-alert text-white hover:opacity-90",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${BUTTON_BASE} ${VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} className={buttonClass(variant, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-3xl border border-brand-line bg-white p-5 ${className}`}>{children}</div>;
}

const BADGE_TONES = {
  neutral: "bg-brand-line/70 text-brand-ink",
  yellow: "bg-brand-yellow text-brand-ink",
  green: "bg-brand-success/15 text-brand-success",
  red: "bg-brand-alert/15 text-brand-alert",
  blue: "bg-blue-100 text-blue-800",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ${BADGE_TONES[tone]}`}>{children}</span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-brand-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-brand-muted">
      <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-sm">{label}...</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-brand-line/70 motion-reduce:animate-none ${className}`} />;
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-brand-line bg-white px-6 py-10 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow/30 text-brand-ink">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="text-lg font-bold">{title}</p>
      {text && <p className="max-w-md text-sm text-brand-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-3xl border border-brand-alert/40 bg-brand-alert/5 px-6 py-8 text-center">
      <AlertCircle className="h-8 w-8 text-brand-alert" aria-hidden="true" />
      <p className="font-semibold">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "error" | "warn"; title?: string; children?: React.ReactNode }) {
  const styles = {
    info: "border-brand-line bg-white",
    success: "border-brand-success/50 bg-brand-success/10",
    error: "border-brand-alert/50 bg-brand-alert/10",
    warn: "border-brand-gold bg-brand-yellow/20",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border p-4 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-brand-muted" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
              active ? "border-brand-yellow bg-brand-yellow text-brand-ink" : "border-brand-line bg-white text-brand-ink hover:bg-brand-line/50"
            }`}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const CONTROL =
  "w-full rounded-2xl border bg-white px-4 text-base placeholder:text-brand-muted/70 disabled:bg-brand-line/40";

function FieldShell({ id, label, error, hint, required, children }: { id: string; label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-brand-alert"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-brand-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-brand-alert">
          {error}
        </p>
      )}
    </div>
  );
}

type FieldBase = { label: string; error?: string; hint?: string; required?: boolean };

export function TextInput({ label, error, hint, required, id, ...rest }: FieldBase & React.InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint} required={required}>
      <input
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...rest}
        className={`${CONTROL} h-12 ${error ? "border-brand-alert" : "border-brand-line"}`}
      />
    </FieldShell>
  );
}

export function TextArea({ label, error, hint, required, id, ...rest }: FieldBase & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint} required={required}>
      <textarea
        id={fid}
        required={required}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...rest}
        className={`${CONTROL} py-3 ${error ? "border-brand-alert" : "border-brand-line"}`}
      />
    </FieldShell>
  );
}

export function SelectInput({
  label,
  error,
  hint,
  required,
  id,
  options,
  placeholder,
  ...rest
}: FieldBase & { options: readonly { value: string; label: string }[]; placeholder?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint} required={required}>
      <select
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...rest}
        className={`${CONTROL} h-12 ${error ? "border-brand-alert" : "border-brand-line"}`}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${
                on ? "border-brand-yellow bg-brand-yellow" : "border-brand-line bg-white hover:bg-brand-line/50"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-brand-line/60">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-4">
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="text-sm text-brand-muted">{label}</p>
      {hint && <p className="mt-1 text-xs text-brand-muted">{hint}</p>}
    </div>
  );
}

export function SponsoredBadge() {
  return <Badge tone="yellow">Sponsored</Badge>;
}

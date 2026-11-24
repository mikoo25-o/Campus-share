"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, HandHeart, ShoppingBasket } from "lucide-react";
import { ROLES, type Role } from "@/lib/roles";

const ICONS = { donor: HandHeart, receiver: ShoppingBasket } as const;

export default function RolePicker({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="How are you joining CampusShare?" className="space-y-4">
        {ROLES.map((r) => {
          const selected = role === r.value;
          const Icon = ICONS[r.value];
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setRole(r.value)}
              className={`w-full rounded-3xl border-2 p-5 text-left ${
                selected
                  ? "border-brand-yellow bg-brand-yellow/15"
                  : "border-brand-line bg-white hover:border-brand-gold"
              }`}
            >
              <span className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-brand-ink">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-xl font-bold">{r.title}</span>
                  <span className="mt-1 block text-brand-muted">{r.summary}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-brand-yellow bg-brand-yellow text-brand-ink"
                      : "border-brand-line bg-white text-transparent"
                  }`}
                >
                  <Check className="h-5 w-5" />
                </span>
              </span>
              <span className="mt-4 block border-t border-brand-line pt-3 text-sm text-brand-muted">
                {r.detail}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-brand-muted">
        Choose how you&apos;d like to participate. You can update your preferences later. Farmers
        and agricultural businesses can also use the farmer market and advertising tools.
      </p>

      <Link
        href={`/signup?role=${role}`}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-8 py-3 text-base font-bold text-brand-ink hover:bg-brand-gold"
      >
        Continue
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Link>

      <p className="text-center text-sm text-brand-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-gold underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

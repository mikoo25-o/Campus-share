"use client";

import Link from "next/link";
import LogoSlot from "./LogoSlot";
import { useAuth } from "./AuthProvider";
import { buttonClass } from "./ui";

/** Header for public pages (home, sign-up, log in). The logo space is at the top of every page. */
export default function SiteHeader() {
  const { user, loading } = useAuth();
  return (
    <header className="border-b border-brand-line bg-brand-cream">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <LogoSlot />
        <nav aria-label="Account" className="flex items-center gap-2">
          {!loading && user ? (
            <Link href="/dashboard" className={buttonClass("primary")}>
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "hidden sm:inline-flex")}>
                Log in
              </Link>
              <Link href="/get-started" className={buttonClass("primary")}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

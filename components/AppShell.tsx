"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogIn, LogOut, Menu, Search, X } from "lucide-react";
import LogoSlot from "./LogoSlot";
import { useAuth } from "./AuthProvider";
import { NAV, TABS, isActive } from "./nav";
import { buttonClass, Spinner } from "./ui";
import { imageUrl } from "@/lib/storage";
import { supabaseConfigured } from "@/lib/supabase/client";

function useUnread() {
  const { supabase, user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!supabase || !user) {
      setCount(0);
      return;
    }
    let active = true;
    const refresh = async () => {
      const { count: n } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (active) setCount(n ?? 0);
    };
    void refresh();
    // Live updates: the database only sends rows this user is allowed to see.
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("campusshare:notifications", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("campusshare:notifications", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  return count;
}

function Avatar({ name, path }: { name: string; path: string | null }) {
  const url = imageUrl("avatars", path);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-yellow text-sm font-bold text-brand-ink">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnread();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("cs-sidebar") === "1");
    } catch {}
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);

  // First sign-in: finish the profile before anything else.
  useEffect(() => {
    if (!loading && user && profile && !profile.onboarding_done && pathname !== "/onboarding") router.replace("/onboarding");
  }, [loading, user, profile, pathname, router]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("cs-sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const items = NAV.filter((i) => (!i.adminOnly || profile?.is_admin) && (user || i.public));
  const signedOut = !loading && !user;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-brand-line bg-brand-cream/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-brand-line/60 lg:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          {/* Reserved logo space: appears at the top of every page. */}
          <LogoSlot />
          <div className="flex-1" />
          {user && (
            <>
              <Link href="/search" aria-label="Search" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-brand-line/60">
                <Search className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                href="/notifications"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-brand-line/60"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex min-w-[18px] items-center justify-center rounded-full bg-brand-alert px-1 text-[11px] font-bold leading-[18px] text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/profile" aria-label="Your profile" className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-brand-line/60 sm:flex">
                <Avatar name={profile?.display_name ?? "?"} path={profile?.avatar_path ?? null} />
                <span className="max-w-[140px] truncate text-sm font-semibold">{profile?.display_name ?? ""}</span>
              </Link>
            </>
          )}
          {signedOut && (
            <>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClass("secondary", "hidden sm:inline-flex")}>
                Log in
              </Link>
              <Link href="/get-started" className={buttonClass("primary")}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex">
        <aside
          className={`sticky top-[65px] hidden h-[calc(100vh-65px)] shrink-0 flex-col justify-between overflow-y-auto border-r border-brand-line bg-white py-4 lg:flex ${
            collapsed ? "w-[76px]" : "w-64"
          }`}
        >
          <nav aria-label="Main" className="space-y-1 px-3">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-3 text-sm font-semibold ${
                    active ? "bg-brand-yellow text-brand-ink" : "text-brand-ink hover:bg-brand-line/60"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1 px-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-brand-muted hover:bg-brand-line/60"
            >
              {collapsed ? <ChevronsRight className="mx-auto h-5 w-5" aria-hidden="true" /> : <ChevronsLeft className="h-5 w-5" aria-hidden="true" />}
              {!collapsed && "Collapse"}
            </button>
            {user && (
              <button
                type="button"
                onClick={signOut}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-brand-muted hover:bg-brand-line/60 ${collapsed ? "justify-center" : ""}`}
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={collapsed ? "sr-only" : ""}>Log out</span>
              </button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          <div className="mx-auto w-full max-w-5xl">
            {!supabaseConfigured && (
              <div role="status" className="mb-6 rounded-2xl border border-brand-gold bg-brand-yellow/20 p-4 text-sm">
                <p className="font-bold">The database is not connected yet</p>
                <p className="mt-0.5 text-brand-muted">
                  Add your Supabase keys to <code className="font-mono text-xs">.env.local</code> and restart. Pages will show empty states until then.
                </p>
              </div>
            )}
            {loading ? <Spinner /> : children}
          </div>
        </main>
      </div>

      {/* Phone navigation */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-line bg-white lg:hidden">
        <ul className="mx-auto flex max-w-xl">
          {TABS.filter((t) => user || t.href === "/find-food" || t.href === "/dashboard").map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold ${active ? "text-brand-gold" : "text-brand-muted"}`}
                >
                  <span className="relative">
                    <t.icon className="h-6 w-6" aria-hidden="true" />
                    {t.href === "/notifications" && unread > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-alert" aria-hidden="true" />}
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-sm flex-col bg-white">
            <div className="flex items-center justify-between border-b border-brand-line p-3">
              <LogoSlot />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-brand-line/60">
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="All sections" className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-3 font-semibold ${isActive(pathname, item.href) ? "bg-brand-yellow" : "hover:bg-brand-line/60"}`}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-brand-line p-3">
              {user ? (
                <button type="button" onClick={signOut} className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 font-semibold hover:bg-brand-line/60">
                  <LogOut className="h-5 w-5" aria-hidden="true" /> Log out
                </button>
              ) : (
                <Link href="/login" className="flex min-h-[48px] items-center gap-3 rounded-2xl px-3 font-semibold hover:bg-brand-line/60">
                  <LogIn className="h-5 w-5" aria-hidden="true" /> Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

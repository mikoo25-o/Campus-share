"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Badge } from "./ui";
import { imageUrl } from "@/lib/storage";
import type { ServedAd } from "@/lib/types";

function sessionKey() {
  try {
    let k = sessionStorage.getItem("cs-ad-session");
    if (!k) {
      k = crypto.randomUUID();
      sessionStorage.setItem("cs-ad-session", k);
    }
    return k;
  } catch {
    return "no-storage";
  }
}

function AdCard({ ad, placement }: { ad: ServedAd; placement: string }) {
  const { supabase } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const counted = useRef(false);
  const img = imageUrl("campaign-images", ad.image_path);

  // An impression is recorded once, when the ad has been on screen for a second. Re-renders do not count.
  useEffect(() => {
    const el = ref.current;
    if (!el || !supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          timer = setTimeout(() => {
            counted.current = true;
            void supabase.rpc("record_ad_event", { p_campaign: ad.id, p_kind: "impression", p_placement: placement, p_session: sessionKey() });
          }, 1000);
        } else if (timer) clearTimeout(timer);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [supabase, ad.id, placement]);

  // The destination is released by the database only when a real click is recorded.
  async function onClick() {
    if (!supabase) return;
    const { data } = await supabase.rpc("record_ad_event", { p_campaign: ad.id, p_kind: "click", p_placement: placement, p_session: sessionKey() });
    const url = (data as { url?: string } | null)?.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <article ref={ref} aria-label={`Sponsored: ${ad.headline}`} className="flex overflow-hidden rounded-3xl border border-brand-line bg-white">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" loading="lazy" className="hidden h-auto w-32 shrink-0 object-cover sm:block" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Badge tone="yellow">Sponsored</Badge>
          <span className="truncate text-xs text-brand-muted">{ad.advertiser}</span>
        </div>
        <p className="text-base font-bold leading-snug">{ad.headline}</p>
        {ad.description && <p className="text-sm text-brand-muted">{ad.description}</p>}
        <button
          type="button"
          onClick={() => void onClick()}
          className="mt-1 inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full bg-brand-yellow px-5 text-sm font-bold text-brand-ink hover:bg-brand-gold"
        >
          {ad.cta_label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

/**
 * Real, approved, paid-for campaigns only. When there are none, nothing is drawn, so the page
 * stays useful without ads. Never shows made-up ads.
 */
export default function AdSlot({
  placement,
  county,
  category,
  limit = 1,
}: {
  placement: "dashboard" | "find_food" | "farmer_market" | "promote" | "recommendations";
  county?: string | null;
  category?: string | null;
  limit?: number;
}) {
  const { supabase, user } = useAuth();
  const [ads, setAds] = useState<ServedAd[]>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    supabase
      .rpc("serve_ads", { p_placement: placement, p_county: county ?? null, p_category: category ?? null, p_limit: limit })
      .then(({ data }) => active && setAds((data as ServedAd[]) ?? []));
    return () => {
      active = false;
    };
  }, [supabase, user, placement, county, category, limit]);

  if (!ads.length) return null;
  return (
    <section aria-label="Sponsored" className="space-y-3">
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} placement={placement} />
      ))}
    </section>
  );
}

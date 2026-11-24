"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { Donation } from "@/lib/types";
import { COUNTY_CENTRES } from "@/lib/constants";

/**
 * Map of available food. Pins sit at the centre of each county, never at a real address,
 * so a donor's location is not revealed before someone reserves.
 */
export default function FoodMap({ items, onSelectCounty }: { items: Donation[]; onSelectCounty?: (c: string) => void }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false }).setView([-0.5, 36.5], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const byCounty = new Map<string, Donation[]>();
      for (const d of items) byCounty.set(d.county, [...(byCounty.get(d.county) ?? []), d]);
      const points: [number, number][] = [];
      byCounty.forEach((list, county) => {
        const c = COUNTY_CENTRES[county];
        if (!c || !map) return;
        points.push(c);
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#FFC629;color:#111820;border:2px solid #111820;border-radius:999px;min-width:32px;height:32px;display:flex;align-items:center;justify-content:center;font:700 14px system-ui">${list.length}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const m = L.marker(c, { icon, title: `${county}: ${list.length} available` }).addTo(map);
        const wrap = document.createElement("div");
        const h = document.createElement("strong");
        h.textContent = `${county} (${list.length})`;
        wrap.appendChild(h);
        const ul = document.createElement("ul");
        ul.style.cssText = "margin:6px 0 0;padding-left:16px";
        list.slice(0, 5).forEach((d) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = `/find-food/${d.id}`;
          a.textContent = d.title;
          a.style.textDecoration = "underline";
          li.appendChild(a);
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
        if (onSelectCounty) {
          const b = document.createElement("button");
          b.textContent = "Show only this county";
          b.style.cssText = "margin-top:8px;font-weight:700;text-decoration:underline";
          b.onclick = () => onSelectCounty(county);
          wrap.appendChild(b);
        }
        m.bindPopup(wrap);
      });
      if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 9 });
      else if (points.length === 1) map.setView(points[0], 9);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [items, onSelectCounty]);

  return (
    <div>
      <div ref={el} className="h-[420px] w-full overflow-hidden rounded-3xl border border-brand-line" role="region" aria-label="Map of available food" />
      <p className="mt-2 text-xs text-brand-muted">
        Pins show the county, not the exact address. Exact pickup details are shared only after you reserve.{" "}
        <Link href="/help" className="underline">Learn more</Link>
      </p>
    </div>
  );
}

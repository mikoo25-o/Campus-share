export function formatKES(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return `KSh ${v.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

export function formatQty(n: number | string, unit: string) {
  const v = Number(n);
  const short: Record<string, string> = { kg: "kg", g: "g", litres: "L" };
  const text = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return `${text} ${short[unit] ?? unit}`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/** "Today 4:30 PM", "Tomorrow 9:00 AM", or a short date. Shown in the viewer's own time zone. */
export function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString("en-KE", { day: "numeric", month: "short" })} ${time}`;
}

export function hoursLeft(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3600000;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/** Great-circle distance in km. Inputs are rounded coordinates, so this is approximate by design. */
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(km: number) {
  return km < 1 ? "under 1 km away" : `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function isoLocalInput(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

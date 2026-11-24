import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { Badge } from "./ui";
import type { Donation } from "@/lib/types";
import { FIRST_IMAGE, imageUrl } from "@/lib/storage";
import { FOOD_CATEGORIES, labelOf } from "@/lib/constants";
import { formatDeadline, formatDistance, formatQty, hoursLeft } from "@/lib/format";

export default function FoodCard({ d, km }: { d: Donation; km?: number | null }) {
  const src = imageUrl("donation-images", FIRST_IMAGE(d.donation_images));
  const urgent = hoursLeft(d.expires_at) < 2;
  return (
    <Link href={`/find-food/${d.id}`} className="group block overflow-hidden rounded-3xl border border-brand-line bg-white hover:border-brand-yellow">
      <div className="aspect-[4/3] bg-brand-line/40">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-brand-muted">No photo</div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{labelOf(FOOD_CATEGORIES, d.category)}</Badge>
          {urgent && <Badge tone="yellow">Collect soon</Badge>}
        </div>
        <h3 className="text-lg font-bold leading-snug group-hover:underline">{d.title}</h3>
        <p className="text-sm font-semibold">{formatQty(d.quantity_remaining, d.unit)} left</p>
        <p className="flex items-center gap-1.5 text-sm text-brand-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {d.town}, {d.county}
          {km != null && ` · ${formatDistance(km)}`}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-brand-muted">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          Collect by {formatDeadline(d.expires_at)}
        </p>
      </div>
    </Link>
  );
}

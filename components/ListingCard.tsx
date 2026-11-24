import Link from "next/link";
import { MapPin } from "lucide-react";
import { Badge } from "./ui";
import type { Listing } from "@/lib/types";
import { FIRST_IMAGE, imageUrl } from "@/lib/storage";
import { PRODUCE_CATEGORIES, PRODUCE_UNITS, labelOf } from "@/lib/constants";
import { formatKES, formatQty } from "@/lib/format";

export default function ListingCard({ l }: { l: Listing }) {
  const src = imageUrl("produce-images", FIRST_IMAGE(l.produce_images));
  const unit = labelOf(PRODUCE_UNITS, l.unit).replace("per ", "");
  return (
    <Link href={`/farmer-market/${l.id}`} className="group block overflow-hidden rounded-3xl border border-brand-line bg-white hover:border-brand-yellow">
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
          <Badge>{labelOf(PRODUCE_CATEGORIES, l.category)}</Badge>
          {l.status === "sold_out" && <Badge tone="red">Sold out</Badge>}
        </div>
        <h3 className="text-lg font-bold leading-snug group-hover:underline">{l.name}</h3>
        <p className="text-lg font-bold">{formatKES(l.price)} <span className="text-sm font-normal text-brand-muted">per {unit}</span></p>
        <p className="text-sm text-brand-muted">{l.farmer_profiles?.farm_name}</p>
        <p className="flex items-center gap-1.5 text-sm text-brand-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {l.town ? `${l.town}, ` : ""}{l.county}
          {l.status !== "sold_out" && ` · ${formatQty(l.quantity_available, l.unit)} available`}
        </p>
      </div>
    </Link>
  );
}

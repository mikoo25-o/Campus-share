"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Reserved space for the CampusShare logo.
 *
 * To add the logo later, drop the file at:
 *   public/images/logo/campusshare-logo.png
 * and the slot will show it automatically. Until then the space is kept
 * (same size, so nothing shifts) and shows a plain outlined box.
 *
 * Change LOGO_SRC below if you use a different file name or format (svg, webp).
 */
const LOGO_SRC = "/images/logo/campusshare-logo.png";

export default function LogoSlot() {
  const [missing, setMissing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The image can fail before React attaches onError (server-rendered page),
  // so also check once on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  return (
    <Link
      href="/"
      aria-label="CampusShare home"
      className="flex h-12 w-44 shrink-0 items-center sm:h-14 sm:w-52"
    >
      {missing ? (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-brand-line text-xs font-medium text-brand-muted"
        >
          Logo space
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={LOGO_SRC}
          alt="CampusShare"
          className="h-full w-full object-contain object-left"
          onError={() => setMissing(true)}
        />
      )}
    </Link>
  );
}

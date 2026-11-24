"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { STAGE_ASPECT, type AdSlide, type Rect } from "@/lib/ad-placeholders";

const INTERVAL_MS = 6000;

/** Where the image sits inside the stage, as percentages of the stage. */
function imageBox(aspect: number, fit: AdSlide["fit"]): Rect {
  if (fit === "cover") {
    if (aspect >= STAGE_ASPECT) {
      // full height, left aligned, right edge trimmed
      return { left: 0, top: 0, width: (aspect / STAGE_ASPECT) * 100, height: 100 };
    }
    // full width, top and bottom trimmed equally
    const height = (STAGE_ASPECT / aspect) * 100;
    return { left: 0, top: (100 - height) / 2, width: 100, height };
  }
  if (aspect >= STAGE_ASPECT) {
    const height = (STAGE_ASPECT / aspect) * 100;
    return { left: 0, top: (100 - height) / 2, width: 100, height };
  }
  const width = (aspect / STAGE_ASPECT) * 100;
  return { left: (100 - width) / 2, top: 0, width, height: 100 };
}

/** Convert a rectangle given relative to the image into stage percentages. */
function place(box: Rect, r: Rect): React.CSSProperties {
  return {
    left: `${box.left + (r.left * box.width) / 100}%`,
    top: `${box.top + (r.top * box.height) / 100}%`,
    width: `${(r.width * box.width) / 100}%`,
    height: `${(r.height * box.height) / 100}%`,
  };
}

function SponsoredBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-ink ${className}`}
    >
      Sponsored
    </span>
  );
}

function Slide({ slide, active, first }: { slide: AdSlide; active: boolean; first: boolean }) {
  const box = imageBox(slide.aspect, slide.fit);
  const light = slide.tone === "light";

  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 transition-[opacity,visibility] duration-700 motion-reduce:transition-none ${
        active ? "visible opacity-100" : "invisible opacity-0"
      }`}
      style={{ backgroundColor: slide.base }}
    >
      {slide.fit === "pillarbox" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
        />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.src}
        alt={slide.alt}
        loading={first ? "eager" : "lazy"}
        decoding="async"
        className={`absolute inset-0 h-full w-full ${
          slide.fit === "cover" ? "object-cover" : "object-contain [clip-path:inset(0_0_0.8%_0)]"
        }`}
        style={slide.fit === "cover" && slide.aspect >= STAGE_ASPECT ? { objectPosition: "left center" } : undefined}
      />

      {slide.badge === "overlay" && (
        <SponsoredBadge className="absolute left-3 top-3 z-10 shadow-sm lg:hidden" />
      )}

      {/* Large screens: copy and labels drawn as real interface elements over the blank banner area. */}
      <div className="absolute inset-0 hidden lg:block">
        {slide.badge === "overlay" && slide.fit === "pillarbox" && (
          <SponsoredBadge className="absolute left-4 top-4 z-10 shadow-sm" />
        )}

        {slide.badge === "pill" && slide.pill && (
          // Grid columns, not padding: percentage padding would resolve against the whole stage width.
          <div
            className="absolute grid grid-cols-[42%_1fr] items-center text-[clamp(10px,1.15cqw,14px)] font-bold text-brand-ink"
            style={place(box, slide.pill)}
          >
            <span aria-hidden="true" />
            <span>Sponsored</span>
          </div>
        )}

        {slide.button && (
          <div
            className="absolute grid grid-cols-[14%_1fr_26%] items-center text-[clamp(11px,1.3cqw,16px)] font-bold text-brand-ink"
            style={place(box, slide.button.rect)}
          >
            <span aria-hidden="true" />
            <span className="whitespace-nowrap">{slide.button.label}</span>
            <span aria-hidden="true" />
          </div>
        )}

        {slide.copy && (
          <div
            className={`absolute flex flex-col justify-center gap-[0.7cqw] ${
              light ? "text-white" : "text-brand-ink"
            }`}
            style={place(box, slide.copy.box)}
          >
            {slide.badge === "overlay" && <SponsoredBadge />}
            <p className="text-[clamp(16px,2.5cqw,30px)] font-bold leading-tight">
              {slide.copy.headline}
            </p>
            <p className="text-[clamp(11px,1.4cqw,16px)] leading-snug opacity-90">
              {slide.copy.body}
            </p>
            {slide.copy.cta && (
              <span className="mt-[0.4cqw] inline-flex w-fit items-center gap-2 rounded-full bg-brand-yellow px-4 py-1.5 text-[clamp(11px,1.3cqw,15px)] font-bold text-brand-ink">
                {slide.copy.cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdCarousel({ slides }: { slides: AdSlide[] }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusing, setFocusing] = useState(false);

  const paused = manualPause || hovering || focusing;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  if (count === 0) return null;

  const go = (next: number) => setIndex((next + count) % count);
  const current = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Sponsored placements"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusing(true)}
      onBlurCapture={() => setFocusing(false)}
    >
      <div
        className="relative aspect-[5.5/1] min-h-[96px] w-full overflow-hidden rounded-3xl border border-brand-line [container-type:inline-size]"
        style={{ backgroundColor: current.base }}
      >
        {slides.map((slide, i) => (
          <Slide key={slide.id} slide={slide} active={i === index} first={i === 0} />
        ))}
      </div>

      {/* Phones and tablets: the copy sits under the image so it stays readable. */}
      <div className="mt-3 min-h-[64px] lg:hidden" aria-live="off">
        <p className="text-base font-bold leading-snug">{current.caption.headline}</p>
        <p className="mt-0.5 text-sm text-brand-muted">{current.caption.body}</p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous advertisement"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-brand-ink hover:bg-brand-line/50"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next advertisement"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-brand-ink hover:bg-brand-line/50"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center" role="group" aria-label="Choose advertisement">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show advertisement ${i + 1} of ${count}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-6 items-center justify-center"
            >
              <span
                className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${
                  i === index ? "w-6 bg-brand-gold" : "w-2.5 bg-brand-line"
                }`}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setManualPause((p) => !p)}
          aria-label={manualPause ? "Resume automatic rotation" : "Pause automatic rotation"}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-brand-ink hover:bg-brand-line/50"
        >
          {manualPause ? (
            <Play className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Pause className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}

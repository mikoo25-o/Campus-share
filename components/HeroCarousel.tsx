"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Globe, Leaf, Pause, Play, Users } from "lucide-react";

export type HeroSlide = {
  src: string;
  alt: string;
  /** CSS object-position, so the subject stays in frame */
  position: string;
};

const INTERVAL_MS = 6500;

const BENEFITS = [
  { icon: Leaf, label: "Reduce food waste" },
  { icon: Users, label: "Support your community" },
  { icon: Globe, label: "Fight climate change" },
];

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
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

  const go = (next: number) => setIndex((next + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="CampusShare in pictures"
      className="relative isolate min-h-[600px] overflow-hidden rounded-3xl bg-brand-night text-white sm:min-h-[540px]"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusing(true)}
      onBlurCapture={() => setFocusing(false)}
    >
      {slides.map((slide, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={slide.src}
          src={slide.src}
          alt={i === index ? slide.alt : ""}
          aria-hidden={i !== index}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          style={{ objectPosition: slide.position }}
          className={`absolute inset-0 -z-20 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Dark overlay only where the text sits, so the photo stays bright on the right. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-night/90 via-brand-night/45 to-brand-night/10 sm:bg-gradient-to-r sm:from-brand-night/90 sm:via-brand-night/55 sm:to-transparent"
      />

      <div className="flex min-h-[600px] flex-col justify-end gap-6 px-6 pb-20 pt-10 sm:min-h-[540px] sm:justify-center sm:px-10 sm:pb-16">
        <h1 className="max-w-md text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
          Good food.
          <br />
          <span className="text-brand-yellow">Less waste.</span>
          <br />A better planet.
        </h1>
        <p className="max-w-md text-base text-white/90 sm:text-lg">
          Join CampusShare and be part of a community that reduces food waste, supports local
          farmers, and helps people access food.
        </p>

        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          {BENEFITS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm font-medium">
              <Icon className="h-6 w-6 text-brand-yellow" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-start gap-3">
          <Link
            href="/get-started"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-brand-yellow px-8 py-3 text-base font-bold text-brand-ink hover:bg-brand-gold"
          >
            Get Started
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="text-sm text-white/85">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-yellow underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-3 flex items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous picture"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-brand-ink hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next picture"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-brand-ink hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center" role="group" aria-label="Choose picture">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show picture ${i + 1} of ${count}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-6 items-center justify-center"
            >
              <span
                className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${
                  i === index ? "w-6 bg-brand-yellow" : "w-2.5 bg-white/70"
                }`}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setManualPause((p) => !p)}
          aria-label={manualPause ? "Resume automatic rotation" : "Pause automatic rotation"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-brand-ink hover:bg-white"
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

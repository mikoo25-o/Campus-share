import Link from "next/link";
import {
  ArrowRight,
  HandHeart,
  Megaphone,
  ShoppingBasket,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import HeroCarousel, { type HeroSlide } from "@/components/HeroCarousel";
import ImpactStats from "@/components/ImpactStats";

/**
 * Add more photos here as they are supplied (a farmer photo and an agricultural supplies photo
 * are still needed in a hero-friendly shape; the wide banners are used on Promote & Advertise).
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    src: "/images/hero/campusshare-student-food.webp",
    alt: "A smiling student on a campus bench enjoying a boxed meal",
    position: "72% 30%",
  },
  {
    src: "/images/hero/campusshare-food-sharing.webp",
    alt: "Hands holding a box of fresh salad, vegetables and grains",
    position: "50% 78%",
  },
];

const FEATURES: { title: string; text: string; href: string; icon: LucideIcon }[] = [
  {
    title: "Donate Food",
    text: "Share surplus food and create impact.",
    href: "/get-started?role=donor",
    icon: HandHeart,
  },
  {
    title: "Find Food",
    text: "Discover nearby food and support local communities.",
    href: "/get-started?role=receiver",
    icon: ShoppingBasket,
  },
  {
    title: "Farmer Market",
    text: "Buy fresh produce directly from farmers.",
    href: "/get-started",
    icon: Wheat,
  },
  {
    title: "Promote & Advertise",
    text: "Grow your business and support the community.",
    href: "/promote",
    icon: Megaphone,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <HeroCarousel slides={HERO_SLIDES} />

      <section id="how-it-works" aria-labelledby="features-heading" className="scroll-mt-6">
        <h2 id="features-heading" className="sr-only">
          What you can do on CampusShare
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, text, href, icon: Icon }) => (
            <li key={title}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-3 rounded-3xl border border-brand-yellow/40 bg-white p-5 hover:border-brand-gold"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-brand-ink">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-lg font-bold">{title}</span>
                <span className="text-sm text-brand-muted">{text}</span>
                <ArrowRight
                  className="mt-auto h-5 w-5 text-brand-gold group-hover:translate-x-1 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="impact-heading"
        className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8"
      >
        <h2 id="impact-heading" className="text-2xl font-bold">
          Our Impact
        </h2>
        <p className="mt-1 text-brand-muted">Real food. Real people. Real change.</p>

        <ImpactStats />

        <p className="mt-5 text-xs text-brand-muted">
          Totals count only donations that were collected and verified, so a new platform starts at zero.
          Emissions figures are estimates, not measurements.
        </p>
      </section>

      <section
        aria-label="Small actions, big impact"
        className="flex items-center justify-between gap-4 rounded-3xl bg-brand-night px-6 py-6 text-white sm:px-10"
      >
        <div className="flex items-center gap-4">
          <Megaphone className="hidden h-10 w-10 text-brand-yellow sm:block" aria-hidden="true" />
          <p className="text-xl leading-snug sm:text-2xl">
            Small actions.
            <br />
            <span className="font-bold text-brand-yellow">Big impact.</span>
          </p>
        </div>
        <Link
          href="#how-it-works"
          aria-label="Learn how CampusShare works"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-brand-ink hover:bg-brand-gold"
        >
          <ArrowRight className="h-6 w-6" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

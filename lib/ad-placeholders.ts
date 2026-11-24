/**
 * PLACEHOLDER ad creatives for the Promote & Advertise carousel.
 *
 * These are stand-ins until approved campaigns exist in the database. Once the
 * ad_campaigns / ad_creatives tables are wired up, the carousel should receive
 * real approved creatives instead and this file can be deleted.
 *
 * All rectangles are percentages of the banner image itself (not the stage),
 * so they keep lining up with the baked-in pills and buttons at any width.
 */

/**
 * Width / height of the carousel stage. Banner images range from 5.0 to 6.6, so none are
 * stretched or cropped; the difference is filled with each slide's base colour.
 * Keep in sync with the aspect-[5.5/1] class in AdCarousel.tsx.
 */
export const STAGE_ASPECT = 5.5;

export type Rect = { left: number; top: number; width: number; height: number };

export type AdSlide = {
  id: string;
  src: string;
  alt: string;
  /** width / height of the image file */
  aspect: number;
  /** solid colour that fills the stage around the image */
  base: string;
  /**
   * banner: whole image shown, spare space filled with the base colour
   * cover: fills the stage, trimming a few percent (right edge, or top and bottom)
   * pillarbox: centred, with a blurred copy behind it
   */
  fit: "banner" | "cover" | "pillarbox";
  /**
   * baked: the image already says "Sponsored"
   * pill: write "Sponsored" into the blank yellow pill baked into the image
   * overlay: show a Sponsored badge as a real interface element
   */
  badge: "baked" | "pill" | "overlay";
  /** colour of text drawn over the image */
  tone: "dark" | "light";
  /** text shown under the carousel on phones and tablets */
  caption: { headline: string; body: string };
  /** large screens only: copy drawn over the blank area of the banner */
  copy?: { box: Rect; headline: string; body: string; cta?: string };
  /** blank yellow pill baked into the image (badge: "pill") */
  pill?: Rect;
  /** blank yellow button baked into the image */
  button?: { rect: Rect; label: string };
};

export const AD_PLACEHOLDERS: AdSlide[] = [
  {
    id: "supplies-finished",
    src: "/images/ads/ad-supplies-sponsored.webp",
    alt: "Placeholder advertisement for seeds, fertilizer and a sprayer, labelled Sponsored",
    aspect: 2112 / 386,
    base: "#0D4727",
    fit: "banner",
    badge: "baked",
    tone: "light",
    caption: {
      headline: "Seeds and fertilizer supplier",
      body: "Placeholder: finished supplier creative.",
    },
  },
  {
    id: "veg-cream",
    src: "/images/ads/ad-veg-cream-blank.webp",
    alt: "Placeholder advertisement with a crate of fresh vegetables on a cream background",
    aspect: 2092 / 422,
    base: "#FDFBEF",
    fit: "cover",
    badge: "overlay",
    tone: "dark",
    caption: {
      headline: "Fresh produce, sold close to home",
      body: "Placeholder copy for a farmer or food seller.",
    },
    copy: {
      box: { left: 3, top: 14, width: 54, height: 72 },
      headline: "Fresh produce, sold close to home",
      body: "Placeholder copy for a farmer or food seller.",
      cta: "Learn more",
    },
  },
  {
    id: "burger-facebook",
    src: "/images/ads/ad-burger-facebook-template.webp",
    alt: "Placeholder restaurant advertisement showing a special burger",
    aspect: 460 / 236,
    base: "#1F2326",
    fit: "pillarbox",
    badge: "overlay",
    tone: "light",
    caption: {
      headline: "Restaurant special",
      body: "Placeholder: sample restaurant creative.",
    },
  },
  {
    id: "farmer-leaf",
    src: "/images/ads/ad-farmer-icon-blank.webp",
    alt: "Placeholder advertisement with a smiling farmer holding fresh vegetables",
    aspect: 2125 / 372,
    base: "#CFE5F6",
    fit: "cover",
    badge: "overlay",
    tone: "dark",
    caption: {
      headline: "Meet the farmers behind your food",
      body: "Placeholder copy for a farmer profile ad.",
    },
    copy: {
      box: { left: 8, top: 14, width: 44, height: 72 },
      headline: "Meet the farmers behind your food",
      body: "Placeholder copy for a farmer profile ad.",
      cta: "Learn more",
    },
  },
  {
    id: "veg-dark",
    src: "/images/ads/ad-veg-dark-blank.webp",
    alt: "Placeholder advertisement with a basket of vegetables on a dark background",
    aspect: 2135 / 325,
    base: "#0A1511",
    fit: "banner",
    badge: "pill",
    tone: "light",
    caption: {
      headline: "Grocer and supermarket promotions",
      body: "Placeholder copy for a food business.",
    },
    pill: { left: 1.9, top: 7.9, width: 12.5, height: 20.3 },
    button: { rect: { left: 77.4, top: 50.2, width: 20.9, height: 32.5 }, label: "Learn more" },
    copy: {
      box: { left: 16, top: 34, width: 58, height: 52 },
      headline: "Grocer and supermarket promotions",
      body: "Placeholder copy for a food business.",
    },
  },
  {
    id: "burger-stock",
    src: "/images/ads/ad-burger-stock-sample.webp",
    alt: "Placeholder promotional graphic for a special burger with free delivery",
    aspect: 576 / 280,
    base: "#E8741C",
    fit: "pillarbox",
    badge: "overlay",
    tone: "dark",
    caption: {
      headline: "Restaurant promotion",
      body: "Placeholder: sample promotional graphic (stock image).",
    },
  },
  {
    id: "supplies-blank",
    src: "/images/ads/ad-supplies-blank.webp",
    alt: "Placeholder advertisement for farm supplies on a green background",
    aspect: 2110 / 373,
    base: "#0D4727",
    fit: "banner",
    badge: "overlay",
    tone: "light",
    caption: {
      headline: "Seeds, fertilizer and farm tools",
      body: "Placeholder copy for an agricultural supplier.",
    },
    copy: {
      box: { left: 14, top: 14, width: 52, height: 72 },
      headline: "Seeds, fertilizer and farm tools",
      body: "Placeholder copy for an agricultural supplier.",
      cta: "Learn more",
    },
  },
  {
    id: "farmer-clean",
    src: "/images/ads/ad-farmer-clean.webp",
    alt: "Placeholder advertisement with a smiling farmer holding vegetables in a field",
    aspect: 2129 / 357,
    base: "#CFE5F6",
    fit: "cover",
    badge: "overlay",
    tone: "dark",
    caption: {
      headline: "Support farmers in your county",
      body: "Placeholder copy for a community promotion.",
    },
    copy: {
      box: { left: 4, top: 14, width: 40, height: 72 },
      headline: "Support farmers in your county",
      body: "Placeholder copy for a community promotion.",
      cta: "Learn more",
    },
  },
];

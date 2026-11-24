import { NextResponse } from "next/server";
import { z } from "zod";
import { aiGuard } from "@/lib/ai/guard";
import { asData, geminiJson, SAFETY_RULES } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const In = z.object({ business: z.string().max(80).optional().default(""), type: z.string().max(40), headline: z.string().max(70).optional().default(""), description: z.string().max(200).optional().default("") });
const Out = z.object({ options: z.array(z.object({ headline: z.string().min(5).max(70), description: z.string().min(5).max(200) })).min(1).max(3) });

export async function POST(req: Request) {
  const g = await aiGuard(req, "ad_copy", 15, In);
  if (g.error) return g.error;
  const b = g.body;
  const out = await geminiJson(
    `You write short, truthful ad copy for small Kenyan businesses on a food-sharing platform. Give 3 options. Headline max 70 characters, description max 200. No false urgency, no health claims, no made-up discounts or numbers. ${SAFETY_RULES} Shape: {"options":[{"headline":string,"description":string}]}`,
    asData("advertiser_input", b),
    Out,
  );
  if (out) return NextResponse.json({ ...out, source: "gemini" });
  const name = b.business || "Our business";
  return NextResponse.json({
    options: [
      { headline: `${name}: serving your community`.slice(0, 70), description: b.description || "Find out what we offer and how to reach us." },
      { headline: `Discover ${name}`.slice(0, 70), description: "Local, friendly and ready to help. Tap to learn more." },
      { headline: `${name} is here for you`.slice(0, 70), description: "See our products and services today." },
    ],
    source: "template",
  });
}

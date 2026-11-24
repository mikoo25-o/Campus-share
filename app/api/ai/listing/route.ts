import { NextResponse } from "next/server";
import { z } from "zod";
import { aiGuard } from "@/lib/ai/guard";
import { asData, geminiJson, SAFETY_RULES } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const In = z.object({ name: z.string().min(3).max(120), category: z.string().max(40), description: z.string().max(1000).optional().default(""), county: z.string().max(40).optional().default("") });
const Out = z.object({ description: z.string().min(10).max(600), keywords: z.array(z.string().max(30)).max(10) });

export async function POST(req: Request) {
  const g = await aiGuard(req, "listing", 20, In);
  if (g.error) return g.error;
  const b = g.body;
  const out = await geminiJson(
    `You help Kenyan farmers write clear, honest produce listings. Write a friendly description under 400 characters and up to 8 lowercase search keywords. Use only facts the farmer supplied. ${SAFETY_RULES} Shape: {"description": string, "keywords": string[]}`,
    asData("farmer_input", b),
    Out,
  );
  if (out) return NextResponse.json({ ...out, source: "gemini" });
  const where = b.county ? ` from ${b.county}` : "";
  return NextResponse.json({
    description: b.description.trim() || `Fresh ${b.name.toLowerCase()}${where}, sold directly by the farmer. Message me to agree quantity, price and pickup or delivery.`,
    keywords: Array.from(new Set([...b.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2), b.category.replace("_", " "), "fresh", "local"])).slice(0, 8),
    source: "template",
  });
}

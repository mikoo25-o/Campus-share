import { NextResponse } from "next/server";
import { aiGuard } from "@/lib/ai/guard";
import { asData, geminiJson, SAFETY_RULES } from "@/lib/ai/gemini";
import { z } from "zod";

export const runtime = "nodejs";
const Out = z.object({ summary: z.string().min(10).max(500) });

export async function POST(req: Request) {
  const g = await aiGuard(req, "impact", 10, null);
  if (g.error) return g.error;
  const { data } = await g.supabase.rpc("user_impact");
  const i = (data ?? {}) as Record<string, number>;
  const out = await geminiJson(
    `Write a warm 2 to 3 sentence summary of this member's impact on a food-sharing platform. Use only the numbers given. ${SAFETY_RULES} Shape: {"summary": string}`,
    asData("impact_numbers", i),
    Out,
  );
  if (out) return NextResponse.json({ ...out, source: "gemini" });
  const kg = Math.round(Number(i.donated_kg ?? 0) * 10) / 10;
  return NextResponse.json({
    summary: `You have shared food in ${i.donated_collections ?? 0} confirmed collections (${kg} kg) and received ${i.received_collections ?? 0}. Every verified collection keeps good food out of the bin.`,
    source: "template",
  });
}

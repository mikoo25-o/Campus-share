import { NextResponse } from "next/server";
import { z } from "zod";
import { aiGuard } from "@/lib/ai/guard";
import { asData, geminiJson, SAFETY_RULES } from "@/lib/ai/gemini";
import { COUNTY_CENTRES } from "@/lib/constants";
import { distanceKm } from "@/lib/format";

export const runtime = "nodejs";
const Out = z.object({ picks: z.array(z.object({ id: z.string().uuid(), reason: z.string().max(200) })).max(6) });

type Row = { id: string; title: string; category: string; county: string; town: string; dietary: string[]; allergens: string[]; expires_at: string; quantity_remaining: number; unit: string };

export async function POST(req: Request) {
  const g = await aiGuard(req, "match", 20, null);
  if (g.error) return g.error;
  const { supabase, user } = g;
  const { data: prefs } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
  const { data: rows } = await supabase
    .from("food_donations")
    .select("id,title,category,county,town,dietary,allergens,expires_at,quantity_remaining,unit")
    .eq("status", "available").gt("expires_at", new Date().toISOString()).gt("quantity_remaining", 0)
    .order("expires_at").limit(40);
  const items = (rows ?? []) as Row[];
  const needs: string[] = prefs?.dietary ?? [];
  const home = prefs?.county as string | undefined;

  // Rule-based scoring is always computed, and it is also the safety net around the AI result.
  const scored = items.map((d) => {
    let score = 50;
    const why: string[] = [];
    const missing = needs.filter((n) => !d.dietary.includes(n));
    if (needs.length && missing.length === 0) { score += 25; why.push(`suits your ${needs.join(", ")} preference`); }
    else if (needs.length) score -= 20 * missing.length;
    if (home && d.county === home) { score += 20; why.push(`in ${home}`); }
    else if (home && COUNTY_CENTRES[home] && COUNTY_CENTRES[d.county]) {
      const km = distanceKm(COUNTY_CENTRES[home], COUNTY_CENTRES[d.county]);
      score -= Math.min(30, km / 10);
    }
    const hrs = (new Date(d.expires_at).getTime() - Date.now()) / 3600000;
    if (hrs < 6) { score += 5; why.push("collect soon"); }
    return { d, score, why, warn: d.allergens.length ? `Contains ${d.allergens.join(", ")}.` : "" };
  }).sort((a, b) => b.score - a.score);

  let picks = scored.slice(0, 5).map((s) => ({ id: s.d.id, title: s.d.title, county: s.d.county, reason: [s.why.join(", ") || "available now", s.warn].filter(Boolean).join(". "), source: "rules" as string }));

  if (prefs?.ai_personalisation !== false && items.length > 1) {
    const out = await geminiJson(
      `Pick up to 5 donations that best fit this receiver and say why in one short sentence each. Never recommend a donation whose dietary tags miss a stated need. Mention allergens if present. Use only ids from the list. ${SAFETY_RULES} Shape: {"picks":[{"id":string,"reason":string}]}`,
      `${asData("receiver", { county: home ?? null, dietary: needs })}\n${asData("donations", items)}`,
      Out,
    );
    if (out) {
      const byId = new Map(items.map((d) => [d.id, d]));
      const valid = out.picks.filter((p) => byId.has(p.id) && needs.every((n) => byId.get(p.id)!.dietary.includes(n)));
      if (valid.length) picks = valid.map((p) => ({ id: p.id, title: byId.get(p.id)!.title, county: byId.get(p.id)!.county, reason: p.reason, source: "gemini" }));
    }
  }
  return NextResponse.json({ picks, total: items.length });
}

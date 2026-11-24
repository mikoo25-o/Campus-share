import { NextResponse } from "next/server";
import { z } from "zod";
import { aiGuard } from "@/lib/ai/guard";
import { asData, geminiJson, SAFETY_RULES } from "@/lib/ai/gemini";
import { COUNTY_CENTRES } from "@/lib/constants";

export const runtime = "nodejs";
const In = z.object({ county: z.string().max(40), crop: z.string().max(60).optional().default("") });
const Out = z.object({ advice: z.array(z.string().min(5).max(300)).min(1).max(6) });

type Weather = { days: { date: string; max: number; min: number; rain: number }[] };

async function forecast(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FNairobi&forecast_days=7`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = await res.json();
    return { days: j.daily.time.map((t: string, i: number) => ({ date: t, max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_sum[i] })) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const g = await aiGuard(req, "climate", 20, In);
  if (g.error) return g.error;
  const { county, crop } = g.body;
  const c = COUNTY_CENTRES[county];
  if (!c) return NextResponse.json({ error: "Choose a county we have a forecast for." }, { status: 400 });
  const weather = await forecast(c[0], c[1]);
  if (!weather) return NextResponse.json({ error: "The weather service isn't reachable right now. Try again shortly." }, { status: 503 });

  const rain = weather.days.reduce((s, d) => s + d.rain, 0);
  const hot = Math.max(...weather.days.map((d) => d.max));
  const out = await geminiJson(
    `You give practical, general crop-care guidance to smallholder farmers in Kenya from a 7 day forecast. Give 3 to 5 short tips. This is general guidance, not an agronomist's advice: do not name chemicals or doses, and do not promise yields. ${SAFETY_RULES} Shape: {"advice": string[]}`,
    `${asData("forecast", { county, ...weather })}\n${asData("crop", crop || "not specified")}`,
    Out,
  );
  const advice = out?.advice ?? [
    rain >= 40 ? "Heavy rain is likely this week. Check drainage and avoid applying fertiliser just before downpours." : rain < 5 ? "Little rain is expected. Water in the early morning or evening and mulch to hold moisture." : "Moderate rain is expected. Use rainy days for planting or transplanting if the soil is not waterlogged.",
    hot >= 32 ? "It will be hot. Shade young seedlings and water more often." : "Temperatures are mild. A good time for field work during the cooler hours.",
    "Harvest ripe produce before heavy rain and keep it shaded and cool until sale.",
  ];
  return NextResponse.json({ county, crop, weather, rainTotal: Math.round(rain * 10) / 10, advice, source: out ? "gemini" : "rules" });
}

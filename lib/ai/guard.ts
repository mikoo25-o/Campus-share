import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Common checks for every AI route: signed in, valid body, and within the daily limit. */
export async function aiGuard<T>(req: Request, feature: string, limit: number, schema: ZodType<T> | null) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "The database is not connected." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Please log in to use this." }, { status: 401 }) };

  let body = {} as T;
  if (schema) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return { error: NextResponse.json({ error: "Invalid request." }, { status: 400 }) };
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { error: NextResponse.json({ error: "Some fields are missing or too long." }, { status: 400 }) };
    body = parsed.data;
  }

  const { data: ok } = await supabase.rpc("ai_take_quota", { p_feature: feature, p_limit: limit });
  if (!ok) return { error: NextResponse.json({ error: "You've reached today's limit for this feature. Try again tomorrow." }, { status: 429 }) };
  return { supabase, user, body };
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. It bypasses Row Level Security, so it is used only for trusted server jobs
 * (scheduled maintenance). Never import this from a client component: "server-only" makes the
 * build fail if anyone tries.
 */
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

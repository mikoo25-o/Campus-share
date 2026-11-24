import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both public Supabase variables are set in .env.local. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Browser Supabase client. Returns null when the project is not configured,
 * so pages can show a clear message instead of crashing.
 * Only the public URL and anon key are used here; secrets stay server-side.
 */
export function getSupabaseBrowserClient() {
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}

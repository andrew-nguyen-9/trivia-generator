// ─────────────────────────────────────────────────────────────
// Supabase client (public / anon, read-only).
//
// Resilient by design (house convention from fantasy-football-tool /
// festival-analyzer): if env vars are absent, getSupabase() returns null and
// every query helper degrades to the committed seed bank instead of throwing.
// The app is fully playable with no backend, and goes live the instant
// NEXT_PUBLIC_SUPABASE_* are set.
// ─────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!url || !anonKey) return null;
  client = createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

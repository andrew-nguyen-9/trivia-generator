// ─────────────────────────────────────────────────────────────
// Database client (Neon serverless Postgres, read-only path).
//
// Replaces the old Supabase client. Same house convention: if the connection
// string is absent, getDb() returns null and every query helper degrades to the
// committed seed bank instead of throwing. The app is fully playable with no
// backend, and goes live the instant DATABASE_URL is set.
//
// Server-only: DATABASE_URL holds credentials and is never NEXT_PUBLIC. Reads
// run inside Server Components (revalidate = 86400), so this is fetched at build
// / once-a-day, never shipped to the browser. Use a read-only Neon role here.
// ─────────────────────────────────────────────────────────────
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const dsn = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;

let sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> | null {
  if (sql) return sql;
  if (!dsn) return null;
  sql = neon(dsn);
  return sql;
}

export function isDbConfigured(): boolean {
  return Boolean(dsn);
}

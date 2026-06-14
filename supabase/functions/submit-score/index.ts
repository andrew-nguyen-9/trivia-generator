// PARLOR — submit-score Edge Function (Deno / Supabase).
//
// This is the ONLY write path to the leaderboard. The frontend's anon key cannot
// insert into `scores` (no RLS insert policy); it POSTs here, and the function
// writes with the SERVICE ROLE key, which bypasses RLS. That keeps the house rule
// intact: "the frontend never writes to the DB directly."
//
// Deploy:
//   supabase functions deploy submit-score --no-verify-jwt
// Required function env (set in the Supabase dashboard):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Light abuse controls: payload validation, score clamping, and a per-IP +
// per-room rate limit (one accepted score every few seconds).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROOMS = new Set([
  "board", "clock", "wedges", "streak", "map", "daily",
  "jukebox", "gallery", "blitz", "connections",
]);

// generous per-room ceilings so obviously-forged scores are rejected
const MAX_SCORE: Record<string, number> = {
  board: 30000, clock: 500, wedges: 6, streak: 9999, map: 500, daily: 500,
  jukebox: 5, gallery: 500, blitz: 500, connections: 4,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// naive in-memory rate limiter (best-effort; resets on cold start)
const lastHit = new Map<string, number>();
const RATE_MS = 3000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: { room?: string; name?: string; score?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const room = String(payload.room ?? "");
  const name = String(payload.name ?? "").trim().slice(0, 12);
  const score = Math.floor(Number(payload.score));

  if (!ROOMS.has(room)) return json({ error: "unknown room" }, 400);
  if (!name) return json({ error: "name required" }, 400);
  if (!Number.isFinite(score) || score < 0 || score > (MAX_SCORE[room] ?? 100000)) {
    return json({ error: "score out of range" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const key = `${ip}:${room}`;
  const now = Date.now();
  if (now - (lastHit.get(key) ?? 0) < RATE_MS) {
    return json({ error: "slow down" }, 429);
  }
  lastHit.set(key, now);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.from("scores").insert({ room, name, score });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});

# PARLOR v3 — Platform

Foundation, the social/share infra, personalization, theming, and the
deploy/QA/CI work. v3.0 is the only segment that edits shared files; everything
else here is additive (new files) or narrowly scoped.

---

## §3.0 — Foundation Freeze  ⚠ HARD GATE

The one segment allowed to touch shared files. **Must merge to `v3` before any
v3.1+ session launches.** Lands all of:

1. **Types + schema.** Any new `QType` members in `lib/types.ts`, matching `qtype`
   enum in `db/schema.sql`, and a timestamp-prefixed `db/migrations/<ts>_v3.sql`.
   Register the audio-room qtype (3.22) and any weekly-case need (3.23) now.
2. **Legacy retirement.** Remove Jukebox/Gallery/Blitz/Connections/Lobby from
   `lib/rooms.ts` `GAME_ROOMS` and `app/page.tsx` `GAMES[]`; delete their
   `app/<room>/` routes. Record the Jukebox audio mechanic as folded into 3.22
   (note only, no code). This is pure shared-file surgery — it lives here so no
   later segment touches the deck/sitemap.
3. **Desktop density + CSS-module convention.** Shared desktop tokens in
   `app/globals.css`; adopt and document a `*.module.css`-per-component convention
   so **no later segment edits `globals.css`**.
4. **`lib/share.ts`** — a Wordle-style emoji-grid builder + a `GameResult`
   interface every game plugs into. The single seam for all social work.
5. **`app/api/og/[room]/route.tsx`** — a parameterized `@vercel/og` share-card
   endpoint; games pass data, never edit the endpoint's shared parts.
6. **New room routes** for 3.22 (audio) and 3.23 (weekly case) registered now, so
   those segments own only their own new files.

**END STATE:** every v3 shared-file change is in; legacy rooms gone from deck +
sitemap; `lib/share.ts` + the OG endpoint exist and are documented; a sample game
imports `lib/share.ts` without touching any shared file. `selftest` + build green.

**The invariant that stays:** the frontend still **never writes the DB**. Sharing
is OG images + emoji text off day-seeded determinism — zero writes, zero accounts.

---

## §3.14 — Share-card polish
Extend the 3.0 OG endpoint with per-room art; build the result-card gallery
(`ShareCard*.tsx`, new). Append to `lib/share.ts` only; any shared-type change is a
3.0 follow-up, not an in-segment edit. **END STATE:** every game's share link
previews its actual run.

## §3.19 — Weak-spot practice
Practice mode + profile already track saved questions/achievements in localStorage.
Compute the weakest category (`lib/weakspot.ts`, new) and route practice there via
`PracticeBar.tsx` / `ProfileDashboard.tsx`. **END STATE:** practice routes to the
weakest category.

## §3.20 — Return loop
Generalize the Séance's `lib/grimoire.ts` into `lib/collection.ts` (new): a
completed-days calendar + a collection that fills across rooms — a reason to return.
Surface on `ProfileDashboard.tsx`. **END STATE:** a visible return habit loop.

## §3.21 — Themed daily sets
Extend `lib/themes.ts` with a cross-room motif (`lib/dailyMotif.ts`, new) — a "music
night" / "1969" day where every room pulls one theme. Obey `lib/rng.ts` SSR rules.
**END STATE:** a dated motif feeds all rooms consistently.

## §3.24 — Preview deploy + QA gates  *(debt #2)*
The four v2 live-env gates never ran (no deployment). Stand up a Vercel **preview
deploy**, then run against it: Lighthouse before/after, playwright mobile sweep,
playwright multi-engine (Chrome/Safari/Firefox), and an axe a11y pass. **Land this
early in Wave D** — several game END STATEs reference these live checks.
`vercel:deploy` + `vercel:env`. **END STATE:** preview URL live; four gates run +
evidence recorded.

## §3.25 — Edge-cache daily reads
Séance/Ladder are dynamic Neon reads per request but deterministic per date. Add a
per-day cache key so each puzzle reads Neon once/day. This touches `lib/queries.ts`
(shared) — keep the change to a thin cache wrapper; anything deeper is a 3.0
follow-up. `vercel:runtime-cache`. **END STATE:** a repeat same-day read is cached.

## §3.26 — Lighthouse CI gate
A `.github/workflows/lighthouse.yml` budget gate on PRs (pairs with 3.24's preview).
**END STATE:** a PR that regresses the budget fails CI. **Shipped.**

Runs on PRs touching `frontend/**`. Builds the app and serves it locally with
`next start` (the seed-bank fallback means CI needs no `DATABASE_URL` and no
Vercel-preview SSO bypass — self-contained, deterministic). `@lhci/cli autorun`
audits `/`, `/board`, `/daily` median-of-3 and **errors** (fails the check) below:
performance 0.8, accessibility / best-practices / SEO 0.9. The LHCI config is
inlined in the workflow (single owned file, no shared `lighthouserc.json`).

---

## Deferred (consciously not in v3)
- **Async leaderboards / DB write path** — would break the no-write invariant;
  revisit only if share-cards prove demand.
- **Private rooms / pass-and-play / realtime** — multiplayer, deferred.
- **Deckbuilding meta** — risks diluting the trivia.
- **Seed-bank-at-scale migration** — real tradeoff against "repo is the database";
  evaluate only when the seed bloat actually bites (`IDEAS.md` §E).

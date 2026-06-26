# PARLOR v3 — Pipeline & Content

The nightly forge, the dbt transform, content quality, and new sources. These
segments touch `pipeline/**`, `transform/**`, and `data/raw/*.jsonl` only —
**no frontend files** — so they never conflict with the game swarm.

Conventions carried from v2 (`../../CLAUDE.md`): scrape **facts**, not questions;
only `question_forge.py` makes questions; every ingest appends to `data/raw/*.jsonl`
(bronze, committed); idempotent upserts on `content_hash`; `selftest.py` is the
offline gate — run it before committing.

---

## §3.11 — Transform Fix  *(the blocker — Séance + Ladder are dark)*

**Symptom:** the nightly fails at the **dbt transform step**. `transform/` is the
DuckDB+dbt project: bronze JSONL → `stg_facts` → marts (`mart_question_bank`,
`mart_category_stats`), with schema tests gating publish. A failure here gates the
whole publish. (See the **DAG note** below — the original "Séance + Ladder go
dark" framing turned out not to match the workflow wiring; the real victim is the
seed-bank refresh.)

**Approach — `superpowers:systematic-debugging` FIRST, do not guess:**
1. Reproduce: from inside `transform/`, run `dbt build --profiles-dir .`. Capture
   the exact failing model or schema test.
2. Map the DAG (`cavecrew-investigator`): `stg_facts.sql` reads bronze; check the
   bronze→staging column contract — a renamed/missing field in `data/raw/*.jsonl`
   or a new fact shape from an ingest is the usual culprit.
3. Root-cause, fix the model **or** the upstream ingest contract (whichever is
   wrong), and add a guard (a dbt test or a `selftest.py` assertion) so the same
   break fails loudly next time.
4. Confirm Séance + Ladder receive data end-to-end.

**Files:** `transform/**`; `pipeline/*.py` only where the bronze contract must
change. **END STATE:** `dbt build` green locally; `selftest` green; root cause +
fix written back into this section; Séance + Ladder get data.

### Root cause (landed)

**Contract drift in the dbt source allow-list.** The `accepted_values` test on
`stg_facts.source` (`transform/models/staging/schema.yml`) is a hand-maintained
allow-list. It was written in the first build and never updated as new ingests
landed:

- `pipeline/curated_ingest.py` writes `source="curated"` (29 rows in committed
  bronze) — **not** in the list.
- `pipeline/wiki_pkg_ingest.py` writes `source="wikipedia_pkg"` (run nightly) —
  also not in the list.

`curated` rows in `data/raw/curated.jsonl` therefore fail the test. dbt's
`build` runs tests *between* layers, so a failed staging test **SKIPs** both
marts (`mart_question_bank`, `mart_category_stats`) — they never materialize.
Reproduce: `cd transform && dbt build --profiles-dir .` → `FAIL 1
accepted_values_stg_facts_source…`, then `SKIP` ×8.

### Fix (landed)

1. **`transform/models/staging/schema.yml`** — added `wikipedia_pkg` and
   `curated` to the `source` allow-list (the two real, registered ingests it was
   missing). `dbt build` → `PASS=16`, marts materialize 1733 facts across all 6
   categories.
2. **Guard — `pipeline/selftest.py`** (`"bronze sources all in dbt
   accepted_values"`): reads the same allow-list out of `schema.yml` and asserts
   every `source` present in `data/raw/*.jsonl` is in it. Runs in both `selftest`
   and `selftest --core-only`, so adding an ingest with a new source literal now
   **fails the offline gate before commit** instead of dying in the nightly's dbt
   step. Verified: dropping `curated` from the list flips the check to `✗ …
   unlisted sources: ['curated']`, exit 1.

**Why a guard, not just a fix:** the allow-list will drift again the next time
someone adds an ingest. The guard ties bronze → the dbt contract at the offline
gate everyone runs before committing, so the break surfaces loudly and early.

### DAG note (correction to the symptom framing)

The premise that "the transform failure takes **Séance + Ladder** dark" does
**not** hold against the current `etl_daily.yml` wiring, and this is worth a look:

- The `puzzles` job (which generates Séance + Ladder) is `needs: ratecap` —
  **independent of `transform`/`publish`**. A red transform job does not stop it.
- `lib/seance.ts` / `lib/ladder.ts` generate from flavor packs (`seanceFlavor`,
  `ladderFlavor`) + the date-seeded RNG and upsert straight to Neon. They read
  **no** marts, seed bank, or bronze. They only go dark when `DATABASE_URL` is
  unset (by design — no seed fallback).

**What the transform failure actually gated:** the `publish` job
(`needs: transform`) — forge questions, refresh `frontend/public/seed-questions.json`,
commit bronze. So the real victim is the **main six rooms' offline seed bank**
going stale, plus the whole run going red (the `notify-failure` issue). If the
intent is for Séance/Ladder to depend on the transform/publish output, that's a
**v3.0 wiring gap** in `etl_daily.yml` (a shared file, out of this segment's
scope) — flagged here rather than silently changed.

---

## §3.12 — Distractor Overhaul  *(MC answers too obvious)*

**Problem:** multiple-choice distractors are too obviously wrong, so the right
answer is guessable without knowing it. Today the forge samples sibling answers
from the same field/category (`question_forge.py` `_clue_distractors` ~L276–306;
the `meta.answer_field` path ~L182–210). Sibling-sampling alone produces clusters
where one option is obviously the odd one out.

**Fix — make distractors *close*:**
- **Same category** (already) **and** same sub-type/entity class.
- **Dates:** distractors within the same decade/era as the answer.
- **Numbers/magnitudes:** same order of magnitude (e.g. all 6-figure populations).
- **Entities:** same role/kind (a rapper's distractors are rappers, not actors).
- Reject sets where one option is trivially separable from the rest.

**Gate:** add a `selftest.py` assertion that flags trivially-distinguishable
distractor sets (a closeness heuristic). **ponytail:** heuristic first; only reach
for an LLM-judge if the heuristic measurably underperforms.

**Files:** `question_forge.py` (distractor fns), `selftest.py`, optional
`pipeline/distractor_quality.py`. **END STATE:** distractors measurably closer
(documented heuristic); selftest gate added + green; seed bank regenerated
(`export_seed.py --from-bronze`).

---

## §3.13 — Deezer + Music Depth  *(album art leaks the answer)*

**Problem:** Deezer `image_guess` music clues show the album cover, which often
contains the artist/album name — the answer is in the image, making them trivial.

**Fix the leak:**
- Stop using answer-revealing covers. Prefer **audio-only** clues (the 30s preview
  already ingested) or **art-stripped** clues. If art is kept, crop/obscure the
  title region or pick covers without text (hard to guarantee — prefer audio).

**Grow music trivia — `superpowers:brainstorming` to pick what's worth building.**
Candidate keyless music qtypes (Deezer + MusicBrainz):
- year-of-release · record label · featured artist · lyric snippet → song ·
  "sampled by / samples" · genre/BPM · chart peak · album → lead single.

Build **≥2** new music qtypes with `selftest` coverage and forge recipes; keep
provenance (`source_url`) on every fact.

**Files:** `music_ingest.py`, the music recipes in `question_forge.py`,
`selftest.py`. **END STATE:** no music clue shows the answer in its image; ≥2 new
music qtypes forged + tested; seed bank regenerated.

### Root cause + fix (landed)

**The leak.** `music_ingest.py` attached the **album cover** (`cover_xl`,
`…/images/cover/…`) as `image_url` on the album-year fact. Covers render the
artist/album **name as text**, so when `forge_clues` reused that fact (THE BOARD:
answer = the masked subject), the answer sat in plain view in the image — and 100
committed `deezer.jsonl` rows carried cover URLs, so a re-ingest alone wasn't enough.

**Two-part fix:**
1. **Forge-time sanitizer** — `_strip_leaky_music_art` (called at the top of
   `forge_all`) nulls `image_url` on `category=="music"` facts whose URL contains
   `/images/cover/`, keeping `/images/artist/` portraits (faces, no title text).
   This sanitizes the **existing** bronze at forge time, so the seed bank is clean
   without a live re-ingest.
2. **Clean source** — the album-year fact now uses the artist portrait `pic`, not
   the cover, so new bronze carries no cover URLs.

**Music depth (4 new keyless recipes, all reusing existing renderers — no frontend
change):** record **label**, **featured artist** (parsed from `feat.` track titles),
and **genre** emit `meta.answer_field` facts that `forge_multiple_choice` consumes;
**BPM** emits `numeric_unit="BPM"` facts that `forge_higher_lower` consumes
(`bpm>0` guard — Deezer's bpm is often unset). One `/album/{id}` + one `/track/{id}`
call per chart artist; every fact keeps `source_url`.

**Guards (`selftest.py`):** per-field forge asserts (label/genre/featured MC + BPM
HL), a forge-level leak guard (no music question carries `/images/cover/` art) and a
not-over-stripped guard (portraits survive), plus a seed-bank leak guard.

**Outcome:** live Deezer ingest (zero-auth) + `export_seed.py --from-bronze`. Music
questions in the seed bank **150 → 256** (MC 18 → 45; BPM higher_lower added);
**0** music images carry cover art (246 portraits); full `selftest` green.

---

# New sources & quality (Wave D)

## §3.15 — Wikidata source
Keyless SPARQL — the underused giant. Structured facts (music/film/sports/science/
art) with stable IDs, no key; backfills screen and broadens every category.
**Files:** `pipeline/wikidata_ingest.py` (new), `data/raw/wikidata.jsonl`,
`selftest.py`. Append-only — never edit other ingests. `context7` for SPARQL.

## §3.16 — Screen starvation fix  *(debt #1)*
`screen_ingest.py` is gated on `TMDB_API_KEY`; with no key the screen category
starves at ~2 questions. Replace TMDB with a **keyless** film/TV source (Wikidata
SPARQL or OMDb-free). **Files:** `pipeline/screen_ingest.py`. **END STATE:** screen
populated without a key.

## §3.17 — Per-source health floor  *(debt #3)*
The nightly enforces only a *total* question floor, which one healthy source clears
alone — a dead source decays silently. Add a per-(source/category) floor so the
next starvation pages someone. **Files:** `pipeline/common.py` (helper), the gate
in `export_seed.py`/`selftest.py`. **END STATE:** a starved source fails the gate
in a test.

## §3.18 — Quality scoring
The forge emits typed questions but doesn't rank them. Add an ambiguity/quality
score so the board picks *good* clues, not just difficulty-tiered ones. Heuristic
first (ponytail); LLM-judge only if it measurably wins; the `databricks/` lab is
the natural home for an offline model later. **Files:** `question_forge.py`
(ranking step) or `pipeline/quality_score.py` (new), `selftest.py`.

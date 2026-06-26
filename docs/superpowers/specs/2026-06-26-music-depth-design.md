# §3.13 — Deezer leak fix + music depth — design

Branch: `phase/3.13-music` (worktree, off `v3`). PR into `v3` only.
Owned files: `pipeline/music_ingest.py`, music recipes in `pipeline/question_forge.py`,
`pipeline/selftest.py`. Firewall: touch nothing else; a shared-file need is a v3.0 gap.

## Problem

1. **Leak.** `music_ingest.py` attaches the **album cover** (`cover_xl`,
   URL `…/images/cover/…`) as `image_url` on the album-year fact. Covers render the
   artist/album **name as text**, so when that fact is reused by `forge_clues`
   (THE BOARD: answer = the masked subject), the answer is visible in the image.
   100 committed `deezer.jsonl` rows carry cover URLs.
2. **Shallow.** Music produces only year_guess / fan-count + album-count numerics /
   clue. No label, genre, featured-artist, or tempo angle.

## Fix the leak (belt + suspenders)

- **Forge sanitizer (fixes existing bronze, offline, now):** add
  `_strip_leaky_music_art(facts)` in `question_forge.py`, called at the top of
  `forge_all`. For `category == "music"`, null `image_url` when the URL contains
  `/images/cover/`. Keeps `/images/artist/` portraits — faces carry no title text,
  a fair visual clue. This sanitizes the 100 existing bronze rows at forge time, so
  `export_seed.py --from-bronze` produces a clean seed bank without a live re-ingest.
- **Clean the source (stops new leaks):** `music_ingest.py` album-year fact uses the
  artist portrait `pic` instead of `cover_xl`. Future bronze carries no cover URLs.

Rejected: source-only fix — leaves the 100 committed bronze rows leaking until a live
re-ingest happens. Rejected: per-qtype masking — detecting "cover text == subject" is
unreliable; art-stripping is the doc's stated preference.

## Grow music depth (all reuse existing renderers — no new qtype strings)

New facts emitted by `music_ingest.py`; **existing** forge recipes consume them, so
nothing on the frontend changes.

| Kind | Fact shape | Consumed by | Renders in |
|---|---|---|---|
| Record label | `meta.answer_field="label"`, `meta.answer=<label>`, `fact_text` contains the label | `forge_multiple_choice` | MC rooms |
| Featured artist | `answer_field="featured_artist"`, answer = guest; parsed from `feat.`/`ft.` in track title | `forge_multiple_choice` | MC rooms |
| Genre | `answer_field="genre"`, answer = genre name | `forge_multiple_choice` | MC rooms |
| BPM | `numeric_value=<bpm>`, `numeric_unit="BPM"` | `forge_higher_lower` | THE STREAK |

- `forge_multiple_choice` needs ≥4 **distinct** answers per `(category, field)` — met
  across 50 chart artists for label / featured / genre.
- **BPM** `ponytail:` Deezer `bpm` is frequently 0/unset; guard `bpm > 0`. May yield few
  facts — the ceiling is named, costs little.
- Provenance: every new fact keeps `source_url` (artist/album `link`).

### Ingest data flow (keyless, ~2 extra calls/artist)

Per chart artist (existing loop in `facts_for_artist`):
- One `GET /album/{id}` on the earliest album → `label`, `genres.data[]`, `tracks.data[]`.
  Feeds label + genre facts; tracklist titles feed featured-artist parsing (free).
- One `GET /track/{id}` on the album's first track → `bpm`. Feeds BPM fact when `> 0`.

## selftest coverage (offline)

- Synthetic music facts per field (≥4 distinct each) → assert `forge_multiple_choice`
  emits a masked-prompt MC for label, featured_artist, genre.
- Synthetic `numeric_unit="BPM"` facts → assert `forge_higher_lower` emits a BPM round.
- **Leak guard (unit):** a music fact with a `/images/cover/` `image_url` → run forge →
  assert the resulting clue/year_guess `image_url` is `None`.
- **Leak guard (seed bank):** assert no `category=="music"` question's `image_url`
  contains `/images/cover/`.

## Seed bank regeneration

Deezer is zero-auth. Decision: **try live, else selftest-only**.
- If `api.deezer.com` reachable → run `music_ingest.py` live (new facts land in bronze)
  → `export_seed.py --from-bronze` = full regen (leak-fix + new qtypes). Report it.
- If unreachable → `export_seed.py --from-bronze` regenerates the **leak-fix only**
  (covers stripped from existing bronze); new qtypes are proven by selftest and land on
  the next nightly. Report it.

## END STATE

No music clue shows the answer in its image; ≥2 new music qtypes (4 built: label,
featured, genre, BPM) forged + selftest-covered; seed bank regenerated. `selftest` green.
Root cause + fix written back into `docs/v3/PIPELINE.md §3.13`.

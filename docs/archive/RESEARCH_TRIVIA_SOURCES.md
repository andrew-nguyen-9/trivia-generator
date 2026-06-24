# Research: Collecting Random Fun Trivia Facts

> Deliverable 1 of the project brief: *"Research the best ways to collect random fun
> trivia facts for questioning."* This doc surveys every viable source, scores them,
> and explains the **fact → question forge** strategy the pipeline uses.

---

## TL;DR — what we chose and why

The best trivia engines don't scrape *questions* — they scrape **facts with structure**
(a subject, a number, a date, a place) and then *forge* questions from them. A fact like
`{"subject": "Bonnie Tyler", "metric": "Deezer fans", "value": 2_400_000}` can become a
multiple-choice question, a higher/lower card, or a Jeopardy clue. One fact, many games.

Our four primary sources (all free, three with zero auth):

| Source | Auth | What it gives us | Game fuel |
|---|---|---|---|
| **Wikipedia REST API** | none | On This Day events, random summaries, page views | Year-guess, Jeopardy clues, history MC |
| **Deezer API** | none | Artist fan counts, album release dates, chart ranks | Higher/lower, year-guess, music MC |
| **Sleeper + ESPN APIs** | none | NFL players, trending adds, team/game data | Sports MC, higher/lower, clues |
| **TMDB API** | free key | Movies/TV: release dates, ratings, budgets, cast | Year-guess, higher/lower, screen MC |

---

## 1. The full source survey

### 1.1 Wikipedia / Wikimedia (⭐ best general-purpose source)

Proven in `music-festival-analyzer/pipeline/festival_scraper.py` (BeautifulSoup over
list pages). For trivia we upgrade to the **structured REST APIs** — no HTML parsing:

- **On This Day** — `GET /api/rest_v1/feed/onthisday/{events|births|deaths|holidays}/{MM}/{DD}`
  Returns dated events with year + linked pages. *Perfect* for WhenTaken-style year
  guessing: every item is already `(description, year)`.
- **Random summary** — `GET /api/rest_v1/page/random/summary`
  One random article with extract + thumbnail. Filter by extract length & page views
  to avoid obscure stubs.
- **Page summary** — `GET /api/rest_v1/page/summary/{title}` — enrich any subject
  (an NFL team, a band, a film) with a clean one-paragraph extract + image.
- **Pageviews API** — popularity signal → difficulty rating. A fact about a page with
  1M monthly views is "easy"; 5k views is "hard". **This is our difficulty engine.**
- **Wikidata SPARQL** (`query.wikidata.org`) — the heavy artillery for Phase 2:
  query *every* country capital, Oscar winner, or band formation year in one shot.
  Structured triples = distractors for free (query 4 siblings, shuffle).

**Etiquette:** custom `User-Agent`, ≤ 1 req/sec, cache aggressively. All of this
already matches the tenacity-retry conventions in the other two repos.

### 1.2 Deezer (⭐ best zero-auth entertainment source)

Already battle-tested in `music-festival-analyzer/pipeline/artist_enricher.py`
(it's the Spotify fallback there — here it's the *primary*):

- `GET /chart/0/artists`, `/chart/0/tracks`, `/chart/0/albums` — current charts.
- `GET /search/artist?q=` → `nb_fan` (fan count) — **ideal higher/lower metric**.
- `GET /artist/{id}/albums` → release dates — year-guess fuel.
- `GET /genre` → genre taxonomy for category tagging.
- 30-second `preview` URLs on tracks → Phase 2 "name that tune" mode.

No API key, no OAuth, generous limits (50 req/5s). The festival analyzer's
log-scale popularity proxy (`log10(nb_fan)/log10(10M) * 100`) is reused verbatim
for difficulty scoring.

### 1.3 Sleeper + ESPN (sports lane, zero auth)

Both proven in `fantasy-football-tool/pipeline/`:

- **Sleeper** `GET /v1/players/nfl` — every NFL player: position, age, college,
  years_exp, height/weight. College → "which college did X attend?" MC questions
  (distractors = other players' colleges). `trending/{add|drop}` → topical questions.
- **ESPN site API** (`site.api.espn.com/.../scoreboard`, `/teams`) — team founding
  years, championships, venues, game scores. The hidden-but-stable JSON endpoints the
  fantasy tool already polls for drafts.

### 1.4 Movies & TV — TMDB over IMDb (decision)

The brief says *"I'm thinking IMDB."* **IMDb has no free public API** — only paid
AWS data licensing or unofficial scrapers (brittle, ToS-gray). The industry-standard
substitute is **TMDB** (themoviedb.org): free key, excellent docs, and **every record
carries its `imdb_id`**, so we keep IMDb identity/linking while using a legal, stable
API. (OMDb is the lighter alternative — 1k req/day free — kept as a documented fallback.)

TMDB gives us: release dates (year-guess), `vote_average` + `popularity`
(higher/lower), budgets/revenues (higher/lower, "did it flop?"), cast/crew
(MC: "who directed…"), poster/backdrop art (visual rounds), and trivia-dense
`tagline`/`overview` text for Jeopardy clues.

### 1.5 Ready-made question banks (used as seasoning, not the meal)

- **Open Trivia DB** (`opentdb.com`) — 4k+ verified MC questions, free, CC BY-SA.
  Great to bulk-load the Pursuit mode on day one. Licensing requires attribution.
- **The Trivia API** (`the-trivia-api.com`) — modern, tagged, free tier for
  non-commercial; nicer metadata than OpenTDB.
- **jService** (Jeopardy archive) — historically the go-to, **now defunct**; the
  underlying J! Archive data is also legally murky. We *imitate the format* instead:
  our forge writes answer-phrased clues from Wikipedia facts.
- **Numbers API** (`numbersapi.com`) — quirky number facts; fun garnish, no structure.
- **API Ninjas /facts, uselessfacts.jsph.pl** — random fact strings. Low structure ⇒
  hard to forge into *verifiable* questions. Skipped for v1.

**Why "seasoning":** prebuilt banks give volume but every serious trivia product
differentiates on *fresh, sourced, structured* facts. Our moat is the forge.

### 1.6 Geography (for the GeoGuessr-adjacent mode)

- **restcountries.com** — every country: capital, population, area, flags (SVG),
  borders. Zero auth. Population/area = higher/lower; capitals = MC; flags = visual MC.
- **Wikipedia coordinates** (`prop=coordinates`) → "place this event on the map"
  (Phase 2, needs a map widget).

---

## 2. The Fact → Question Forge (core design)

Scraping questions ties you to one game. Scraping **facts** powers all of them:

```
fact {
  source        wikipedia | deezer | sleeper | espn | tmdb | restcountries
  category      history | music | sports | screen | geography | wildcard
  subject       "Lollapalooza" / "Patrick Mahomes" / "Pulp Fiction"
  fact_text     human sentence, always citeable (source_url)
  year          1991            ── fuels TIMELINE (year-guess)
  numeric_value 2_400_000       ── fuels STREAK (higher/lower)
  numeric_unit  "Deezer fans"
  image_url     poster/photo    ── fuels visual rounds
  meta          jsonb (raw API payload slice)
}
```

`question_forge.py` then derives typed questions:

| qtype | Recipe | Distractors |
|---|---|---|
| `multiple_choice` | template over fact fields | **sibling sampling**: 3 facts from the same category with the same field, deduped, shuffled |
| `year_guess` | any fact with `year` | none needed — scored by distance |
| `higher_lower` | pair two facts sharing `numeric_unit` | none — the pair *is* the question |
| `clue` (Jeopardy) | answer-phrased declarative from `fact_text` | none — free response/reveal |

**Difficulty** = percentile of popularity signal (Wikipedia pageviews, Deezer
`nb_fan`, TMDB `popularity`) within category → 1–5 scale → Jeopardy row values
($200–$1000) fall out automatically.

**Quality gates** (in the forge, not the games):
1. Every question keeps `source_url` — disputes resolve in one click.
2. Reject facts with hedged language ("approximately", "believed to be") for
   exact-answer modes; allow them for year-guess (distance-scored).
3. Distractors must be type-consistent (a college distracts a college) and
   plausibility-banded (within ±1 difficulty).
4. Upserts keyed on a content hash — idempotent re-runs, per house convention.

---

## 3. Freshness model

| Cadence | Job | Why |
|---|---|---|
| Daily cron | Deezer charts, Sleeper trending, TMDB trending, On This Day for *today* | topical "ripped from the charts" questions |
| Weekly | Wikipedia random sweep, TMDB discover backfill, restcountries | grow the evergreen bank |
| On demand | `--subject` flag on any ingest | seed a themed night ("90s movies week") |

Same GitHub Actions cron pattern as `etl_daily.yml` in both reference repos.

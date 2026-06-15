"""
screen_ingest.py
----------------
TMDB API → facts (screen: movies + TV).

Why TMDB and not IMDb: IMDb has no free public API; TMDB is free, stable, and
returns imdb_id on every record so IMDb identity is preserved (see
docs/RESEARCH_TRIVIA_SOURCES.md §1.4). Requires TMDB_API_KEY (free at
themoviedb.org → Settings → API).

Facts produced per title:
- release year     → year_guess fuel
- vote_average     → higher_lower fuel ("TMDB rating")
- director (movies)→ multiple_choice fuel

Run:
    python screen_ingest.py                 # trending + top-rated sweep
    python screen_ingest.py --pages 3

Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse
import os

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w780"


def _key() -> str:
    key = os.environ.get("TMDB_API_KEY")
    if not key:
        raise SystemExit("TMDB_API_KEY not set (free at themoviedb.org)")
    return key


def movie_facts(m: dict, api_key: str) -> list[dict]:
    title = m.get("title")
    date = m.get("release_date") or ""
    if not title or len(date) < 4:
        return []
    year = int(date[:4])
    poster = f"{IMG}{m['poster_path']}" if m.get("poster_path") else None
    url = f"https://www.themoviedb.org/movie/{m['id']}"
    pop = min(100.0, float(m.get("popularity") or 0))
    out = [
        make_fact(
            source="tmdb", category="screen", subject=title,
            fact_text=f"The film “{title}” was released in {year}.",
            year=year, image_url=poster, source_url=url, popularity=pop,
            meta={"tmdb_id": m["id"]},
        )
    ]
    if m.get("vote_count", 0) >= 200:
        out.append(
            make_fact(
                source="tmdb", category="screen", subject=title,
                fact_text=f"“{title}” ({year}) holds a {m['vote_average']:.1f}/10 rating on TMDB.",
                numeric_value=float(m["vote_average"]), numeric_unit="TMDB rating",
                image_url=poster, source_url=url, popularity=pop,
                meta={"vote_count": m.get("vote_count")},
            )
        )
    # director lookup (one extra call; worth it for MC fuel)
    credits = get_json(f"{API}/movie/{m['id']}/credits", params={"api_key": api_key})
    director = next((c["name"] for c in credits.get("crew", []) if c.get("job") == "Director"), None)
    if director:
        out.append(
            make_fact(
                source="tmdb", category="screen", subject=title,
                fact_text=f"“{title}” ({year}) was directed by {director}.",
                image_url=poster, source_url=url, popularity=pop,
                meta={"answer_field": "director", "answer": director},
            )
        )
    # THE GALLERY: name the film from its poster (image_guess fuel)
    if poster:
        out.append(
            make_fact(
                source="tmdb", category="screen", subject=title,
                fact_text=f"A promotional poster for the film “{title}” ({year}).",
                image_url=poster, source_url=url, popularity=pop,
                meta={"answer_field": "poster", "answer": title},
            )
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=2, help="pages each of trending + top_rated (20/page)")
    args = ap.parse_args()
    api_key = _key()

    console.rule("[bold]TMDB ingest")
    movies: dict[int, dict] = {}
    for page in range(1, args.pages + 1):
        for endpoint in ("trending/movie/week", "movie/top_rated"):
            data = get_json(f"{API}/{endpoint}", params={"api_key": api_key, "page": page})
            for m in data.get("results", []):
                movies[m["id"]] = m

    facts: list[dict] = []
    for m in movies.values():
        try:
            facts.extend(movie_facts(m, api_key))
        except Exception as e:
            console.print(f"[yellow]skip {m.get('title')}: {e}[/yellow]")

    dump_raw("tmdb", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()

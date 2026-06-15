"""
sports_ingest.py
----------------
Sleeper + ESPN APIs → facts (sports). Zero auth. Endpoints proven in
fantasy-football-tool/pipeline/{player_ingest,league_sync}.py.

Facts produced:
- Sleeper trending players → topical higher_lower ("waiver adds in 24h") + MC (college)
- ESPN teams              → MC fuel (venue, location)

API efficiency (Phase 6): the full player dict (/v1/players/nfl, ~50-100 MB) is
now cached to data/cache/sleeper_players.json and refreshed at most once per week.
The trending call is always fresh (it drives the questions). This cuts ~300 MB/week
of redundant transfer.

Run:
    python sports_ingest.py
    python sports_ingest.py --trending-limit 40

Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse

from common import (
    CACHE_DIR,
    console,
    dump_raw,
    get_json,
    get_db,
    load_json_cache,
    make_fact,
    save_json_cache,
    upsert_facts,
)

SLEEPER = "https://api.sleeper.app/v1"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"

_PLAYERS_CACHE = CACHE_DIR / "sleeper_players.json"
_PLAYERS_MAX_AGE = 7 * 86400  # refresh player dict at most once a week


def _load_players() -> dict:
    """Return the Sleeper player dict, using a weekly on-disk cache to avoid
    re-downloading ~50-100 MB every day."""
    cached = load_json_cache(_PLAYERS_CACHE, max_age_seconds=_PLAYERS_MAX_AGE)
    if cached is not None:
        console.print(f"[dim]sleeper players: using cached dict ({len(cached)} players)[/dim]")
        return cached
    console.print("[dim]sleeper players: refreshing full dict...[/dim]")
    players = get_json(f"{SLEEPER}/players/nfl")
    save_json_cache(_PLAYERS_CACHE, players)
    console.print(f"[dim]sleeper players: cached {len(players)} players → {_PLAYERS_CACHE.name}[/dim]")
    return players


def fetch_trending_facts(limit: int) -> list[dict]:
    players = _load_players()
    trending = get_json(f"{SLEEPER}/players/nfl/trending/add", params={"lookback_hours": 24, "limit": limit})

    facts = []
    for t in trending:
        p = players.get(t.get("player_id") or "", {})
        name = p.get("full_name")
        if not name or p.get("position") not in {"QB", "RB", "WR", "TE", "K"}:
            continue
        adds = t.get("count", 0)
        college = p.get("college")
        pos, team = p.get("position"), p.get("team") or "FA"
        pop = min(100.0, 30 + (p.get("search_rank") and max(0, 70 - p["search_rank"] / 50) or 0))

        facts.append(
            make_fact(
                source="sleeper", category="sports", subject=name,
                fact_text=f"{name} ({pos}, {team}) was added in {adds:,} fantasy leagues in the last 24 hours.",
                numeric_value=float(adds), numeric_unit="fantasy adds (24h)",
                source_url="https://sleeper.com", popularity=pop,
                meta={},  # pos/team are in fact_text; not read by forge
            )
        )
        if college:
            facts.append(
                make_fact(
                    source="sleeper", category="sports", subject=name,
                    fact_text=f"{name} ({pos}, {team}) played college football at {college}.",
                    source_url="https://sleeper.com", popularity=pop,
                    meta={"answer_field": "college", "answer": college},
                )
            )
    return facts


def fetch_espn_team_facts() -> list[dict]:
    data = get_json(f"{ESPN}/teams")
    teams = (
        data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
    )
    facts = []
    for wrap in teams:
        t = wrap.get("team", {})
        name = t.get("displayName")
        if not name:
            continue
        venue = (t.get("venue") or {}).get("fullName")
        logo = (t.get("logos") or [{}])[0].get("href")
        if venue:
            facts.append(
                make_fact(
                    source="espn", category="sports", subject=name,
                    fact_text=f"The {name} play their home games at {venue}.",
                    image_url=logo, source_url="https://www.espn.com/nfl/",
                    popularity=75.0,
                    meta={"answer_field": "venue", "answer": venue},
                )
            )
    return facts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--trending-limit", type=int, default=25)
    args = ap.parse_args()

    console.rule("[bold]Sports ingest — Sleeper + ESPN")
    facts = fetch_trending_facts(args.trending_limit) + fetch_espn_team_facts()
    dump_raw("sports", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()

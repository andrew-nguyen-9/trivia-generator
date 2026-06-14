"""
music_ingest.py
---------------
Deezer API → facts (music). Zero auth — same endpoints the festival analyzer's
artist_enricher falls back to, promoted here to primary source.

Facts produced per chart artist:
- fan count            → higher_lower fuel ("Deezer fans")
- earliest album year  → year_guess fuel
- album count          → multiple_choice fuel

Run:
    python music_ingest.py                 # top 50 chart artists
    python music_ingest.py --limit 100
    python music_ingest.py --artist "Daft Punk"

Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse
import math

from common import console, dump_raw, get_json, get_supabase, make_fact, upsert_facts

API = "https://api.deezer.com"


def _popularity(nb_fan: int) -> float:
    # log-scale fan count → 0-100 (10M fans ≈ 100) — borrowed from artist_enricher.py
    return min(100.0, math.log10(max(1, nb_fan)) / math.log10(10_000_000) * 100)


def facts_for_artist(artist: dict) -> list[dict]:
    out = []
    name = artist["name"]
    nb_fan = artist.get("nb_fan") or 0
    link = artist.get("link") or f"https://www.deezer.com/artist/{artist['id']}"
    pic = artist.get("picture_xl") or artist.get("picture_big")
    if pic and "/artist//" in pic:  # Deezer's blank-image quirk (see artist_enricher)
        pic = None
    pop = _popularity(nb_fan)

    if nb_fan > 1000:
        out.append(
            make_fact(
                source="deezer", category="music", subject=name,
                fact_text=f"{name} has {nb_fan:,} fans on Deezer.",
                numeric_value=float(nb_fan), numeric_unit="Deezer fans",
                image_url=pic, source_url=link, popularity=pop,
                meta={"deezer_id": artist["id"]},
            )
        )

    albums = get_json(f"{API}/artist/{artist['id']}/albums", params={"limit": 100})
    dated = [a for a in albums.get("data", []) if a.get("release_date")]
    if dated:
        first = min(dated, key=lambda a: a["release_date"])
        year = int(first["release_date"][:4])
        if year > 1900:
            out.append(
                make_fact(
                    source="deezer", category="music", subject=name,
                    fact_text=f"{name} released the album “{first['title']}” in {year}.",
                    year=year, image_url=first.get("cover_xl") or pic,
                    source_url=link, popularity=pop,
                    meta={"album_id": first["id"], "album": first["title"]},
                )
            )
        out.append(
            make_fact(
                source="deezer", category="music", subject=name,
                fact_text=f"{name} has {len(dated)} albums on Deezer.",
                numeric_value=float(len(dated)), numeric_unit="Deezer albums",
                image_url=pic, source_url=link, popularity=pop,
                meta={},
            )
        )
    return out


def facts_for_track(track: dict) -> list[dict]:
    """THE JUKEBOX: a chart track's 30-second preview clip → audio_guess fuel.
    The answer is the artist (lots of sibling distractors from the same chart)."""
    preview = track.get("preview")
    artist = (track.get("artist") or {}).get("name")
    title = track.get("title")
    if not (preview and artist and title):
        return []
    cover = (track.get("album") or {}).get("cover_xl")
    link = track.get("link") or f"https://www.deezer.com/track/{track['id']}"
    return [
        make_fact(
            source="deezer", category="music", subject=title,
            fact_text=f"A 30-second preview of “{title}” by {artist}.",
            image_url=cover, source_url=link, popularity=50.0,
            meta={
                "answer_field": "artist", "answer": artist,
                "preview_url": preview,
                "audio_prompt": "Name the artist of this track.",
            },
        )
    ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--artist", help="single-artist targeted run")
    args = ap.parse_args()

    console.rule("[bold]Deezer ingest")
    if args.artist:
        found = get_json(f"{API}/search/artist", params={"q": args.artist, "limit": 1})
        artists = found.get("data", [])
        # search results omit nb_fan detail → refetch full record
        artists = [get_json(f"{API}/artist/{a['id']}") for a in artists]
    else:
        chart = get_json(f"{API}/chart/0/artists", params={"limit": args.limit})
        artists = [get_json(f"{API}/artist/{a['id']}") for a in chart.get("data", [])]

    facts: list[dict] = []
    for a in artists:
        try:
            facts.extend(facts_for_artist(a))
        except Exception as e:  # one bad artist never kills the run
            console.print(f"[yellow]skip {a.get('name')}: {e}[/yellow]")

    if not args.artist:  # chart tracks → Jukebox audio fuel
        try:
            tracks = get_json(f"{API}/chart/0/tracks", params={"limit": args.limit})
            for t in tracks.get("data", []):
                facts.extend(facts_for_track(t))
        except Exception as e:
            console.print(f"[yellow]skip chart tracks: {e}[/yellow]")

    dump_raw("deezer", facts)
    n = upsert_facts(get_supabase(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()

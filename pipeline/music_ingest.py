"""
music_ingest.py
---------------
Deezer API → facts (music). Zero auth — same endpoints the festival analyzer's
artist_enricher falls back to, promoted here to primary source.

Facts produced per chart artist:
- fan count            → higher_lower fuel ("Deezer fans")
- earliest album year  → year_guess fuel
- label/genre/featured-artist/BPM → music depth (§3.13)

API efficiency (Phase 6): the chart endpoint already returns nb_fan, picture_xl,
and link for each artist — we no longer re-fetch /artist/{id} for chart mode.
The per-artist re-fetch was ~50 redundant calls/day that added no new data.

Run:
    python music_ingest.py                 # top 50 chart artists
    python music_ingest.py --limit 100
    python music_ingest.py --artist "Daft Punk"

Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse
import math
import re

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts

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
                meta={},  # deezer_id not read downstream; keep meta lean
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
                    # ponytail: covers embed the title/artist as text → leaks the answer in clue mode; use the portrait
                    year=year, image_url=pic,
                    source_url=link, popularity=pop,
                    meta={},  # album_id/album not read by forge
                )
            )
        # ponytail: "Deezer albums" count dropped as a question source (too
        # trivia-useless / unguessable) — was the only consumer of len(dated)
        # beyond picking `first` above.
        # ── music depth (§3.13): label / genre / featured-artist / BPM ─────────
        # One /album/{id} call (label + genres + tracklist) + one /track/{id} (bpm).
        try:
            album = get_json(f"{API}/album/{first['id']}")
            alink = album.get("link") or link
            label = (album.get("label") or "").strip()
            if label:
                out.append(make_fact(
                    source="deezer", category="music", subject=name,
                    fact_text=f"{name}'s album “{first['title']}” was released on the label {label}.",
                    image_url=pic, source_url=alink, popularity=pop,
                    meta={"answer_field": "label", "answer": label},
                ))
            genres = [g.get("name") for g in (album.get("genres") or {}).get("data", []) if g.get("name")]
            if genres:
                genre = genres[0]
                out.append(make_fact(
                    source="deezer", category="music", subject=name,
                    fact_text=f"{name}'s album “{first['title']}” is categorized as {genre}.",
                    image_url=pic, source_url=alink, popularity=pop,
                    meta={"answer_field": "genre", "answer": genre},
                ))
            tracks = (album.get("tracks") or {}).get("data", [])
            # featured artist parsed from the track title — free, no extra call
            for t in tracks:
                m = re.search(r"\((?:feat\.?|ft\.?)\s+([^)]+)\)", t.get("title", ""), re.I)
                if not m:
                    continue
                guest = m.group(1).strip().split(",")[0].split(" & ")[0].strip()
                base = re.sub(r"\s*\((?:feat\.?|ft\.?)[^)]*\)", "", t["title"], flags=re.I).strip()
                if guest and guest.lower() != name.lower():
                    out.append(make_fact(
                        source="deezer", category="music", subject=name,
                        fact_text=f"On the track “{base}”, {name} features {guest}.",
                        image_url=pic, source_url=alink, popularity=pop,
                        meta={"answer_field": "featured_artist", "answer": guest},
                    ))
                    break  # one featured-artist fact per artist is plenty
            # BPM — ponytail: Deezer bpm is frequently 0/unset; guard >0, may be sparse
            if tracks:
                tr = get_json(f"{API}/track/{tracks[0]['id']}")
                bpm = tr.get("bpm") or 0
                if bpm and bpm > 0:
                    out.append(make_fact(
                        source="deezer", category="music", subject=f"“{tracks[0]['title']}” — {name}",
                        fact_text=f"“{tracks[0]['title']}” by {name} has a tempo of {round(bpm)} BPM.",
                        numeric_value=float(bpm), numeric_unit="BPM",
                        image_url=pic, source_url=alink, popularity=pop, meta={},
                    ))
        except Exception as e:  # album/track detail is enrichment — never lose core facts
            console.print(f"[yellow]music-depth skip {name}: {e}[/yellow]")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--artist", help="single-artist targeted run")
    args = ap.parse_args()

    console.rule("[bold]Deezer ingest")
    if args.artist:
        found = get_json(f"{API}/search/artist", params={"q": args.artist, "limit": 1})
        artists = found.get("data", [])
        # search results omit nb_fan detail → refetch full record (single artist, not bulk)
        artists = [get_json(f"{API}/artist/{a['id']}") for a in artists]
    else:
        chart = get_json(f"{API}/chart/0/artists", params={"limit": args.limit})
        # Chart payload already includes nb_fan, picture_xl, link — no per-artist re-fetch needed
        artists = chart.get("data", [])

    facts: list[dict] = []
    for a in artists:
        try:
            facts.extend(facts_for_artist(a))
        except Exception as e:  # one bad artist never kills the run
            console.print(f"[yellow]skip {a.get('name')}: {e}[/yellow]")

    dump_raw("deezer", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()

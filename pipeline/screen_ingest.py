"""
screen_ingest.py
----------------
Wikidata SPARQL → facts (screen: films + TV series). **Keyless.**

Why the swap (debt #1, §3.16): the old TMDB path was gated on TMDB_API_KEY, so
with no key the screen category starved at ~2 questions. Wikidata's query service
(WDQS) is free, no-auth, and exposes the same fuel — release year, box office,
director, and a Commons poster/still — for the most famous titles. We rank by
sitelink count (how many Wikipedia editions cover a title) as a fame proxy, the
keyless stand-in for TMDB's popularity score.

Facts produced per title:
- earliest release year → year_guess fuel (THE CLOCK / vague→specific clues)
- box office (USD)      → higher_lower fuel (paired by numeric_unit)
- director              → multiple_choice fuel (meta.answer_field="director")
- Commons poster/still  → image_guess fuel  (meta.answer_field="poster", THE GALLERY)

WDQS note: aggregating over *all* films times out the 20s endpoint, so we run two
cheap queries — top-N QIDs by fame, then a bounded property fetch for just those.

Run:
    python screen_ingest.py                 # top 250 titles by fame
    python screen_ingest.py --limit 400
    python screen_ingest.py --min-fame 40   # lower sitelink floor = more titles

Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts

WDQS = "https://query.wikidata.org/sparql"
# instance-of targets: film (Q11424), television series (Q5398426)
TYPES = "wd:Q11424 wd:Q5398426"


def _val(binding: dict, key: str) -> str | None:
    """Pull a SPARQL binding's literal/URI value, or None if absent."""
    return (binding.get(key) or {}).get("value")


def _query(sparql: str) -> list[dict]:
    data = get_json(WDQS, params={"format": "json", "query": sparql})
    return data["results"]["bindings"]


def top_qids(limit: int, min_fame: int) -> list[str]:
    """Cheapest query WDQS will answer fast: titles ordered by sitelink fame."""
    rows = _query(
        f"SELECT ?item ?fame WHERE {{"
        f"  VALUES ?type {{ {TYPES} }}"
        f"  ?item wdt:P31 ?type; wikibase:sitelinks ?fame."
        f"  FILTER(?fame >= {int(min_fame)})"
        f"}} ORDER BY DESC(?fame) LIMIT {int(limit)}"
    )
    return [r["item"]["value"].rsplit("/", 1)[1] for r in rows]


def fetch_props(qids: list[str]) -> list[dict]:
    """Bounded property fetch for the given QIDs — fast because VALUES caps the
    aggregation to len(qids) rows. Manual rdfs:label (not the label SERVICE,
    which misbinds under GROUP BY)."""
    vals = " ".join(f"wd:{q}" for q in qids)
    return _query(
        "SELECT ?item ?itemLabel ?fame (MIN(?d) AS ?date)"
        " (SAMPLE(?dirLabel) AS ?director) (MAX(?bo) AS ?box) (SAMPLE(?img) AS ?image) WHERE {"
        f"  VALUES ?item {{ {vals} }}"
        '  ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel) = "en")'
        "  ?item wikibase:sitelinks ?fame."
        # COALESCE publication date (films) with start time (TV) so series get a year too
        "  OPTIONAL { ?item wdt:P577 ?pd. }"
        "  OPTIONAL { ?item wdt:P580 ?sd. }"
        "  BIND(COALESCE(?pd, ?sd) AS ?d)"
        '  OPTIONAL { ?item wdt:P57 ?dir. ?dir rdfs:label ?dirLabel. FILTER(LANG(?dirLabel) = "en") }'
        "  OPTIONAL { ?item wdt:P2142 ?bo. }"
        "  OPTIONAL { ?item wdt:P18 ?img. }"
        "} GROUP BY ?item ?itemLabel ?fame"
    )


def row_to_facts(b: dict) -> list[dict]:
    """One WDQS result row → 0..4 facts, mirroring the qtypes the forge expects."""
    title = _val(b, "itemLabel")
    if not title:
        return []
    qid = _val(b, "item").rsplit("/", 1)[1]
    url = f"https://www.wikidata.org/wiki/{qid}"
    image = _val(b, "image")  # P18 is already a resolvable Special:FilePath URL
    fame = float(_val(b, "fame") or 0)
    pop = min(100.0, fame * 0.7)  # ponytail: linear fame→popularity; top titles cap at 100

    out: list[dict] = []

    date = _val(b, "date") or ""
    year = int(date[:4]) if len(date) >= 4 and date[:4].isdigit() else None
    if year and 1870 < year <= 2100:  # cinema starts ~1888; guard junk dates
        out.append(make_fact(
            source="wikidata", category="screen", subject=title,
            fact_text=f"“{title}” was first released in {year}.",
            year=year, image_url=image, source_url=url, popularity=pop,
            meta={"wikidata_id": qid},
        ))

    box = _val(b, "box")
    if box and float(box) > 0:
        gross = float(box)
        out.append(make_fact(
            source="wikidata", category="screen", subject=title,
            fact_text=f"“{title}” grossed ${gross:,.0f} at the box office.",
            numeric_value=gross, numeric_unit="box office (USD)",  # ponytail: P2142 is overwhelmingly USD for famous titles
            image_url=image, source_url=url, popularity=pop, meta={},
        ))

    director = _val(b, "director")
    if director:
        # fact_text MUST contain the answer verbatim — forge_multiple_choice blanks it out
        out.append(make_fact(
            source="wikidata", category="screen", subject=title,
            fact_text=f"“{title}” was directed by {director}.",
            image_url=image, source_url=url, popularity=pop,
            meta={"answer_field": "director", "answer": director},
        ))

    if image:
        out.append(make_fact(
            source="wikidata", category="screen", subject=title,
            fact_text=f"A promotional image for “{title}”.",
            image_url=image, source_url=url, popularity=pop,
            meta={"answer_field": "poster", "answer": title},
        ))

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=250, help="number of titles to fetch (by fame)")
    ap.add_argument("--min-fame", type=int, default=40, help="minimum sitelink count")
    ap.add_argument("--batch", type=int, default=100, help="QIDs per property query")
    args = ap.parse_args()

    console.rule("[bold]Wikidata screen ingest (keyless)")
    qids = top_qids(args.limit, args.min_fame)
    console.print(f"top {len(qids)} titles by fame")

    facts: list[dict] = []
    for i in range(0, len(qids), args.batch):
        rows = fetch_props(qids[i : i + args.batch])
        for b in rows:
            try:
                facts.extend(row_to_facts(b))
            except Exception as e:  # one bad row never kills the run
                console.print(f"[yellow]skip {_val(b, 'itemLabel')}: {e}[/yellow]")

    dump_raw("wikidata_screen", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


def _selfcheck() -> None:
    """Offline parse check — no network. Mirrors a real WDQS row so the row→facts
    mapping (year guard, verbatim-answer requirement, box office) stays honest."""
    row = {
        "item": {"value": "http://www.wikidata.org/entity/Q23572"},
        "itemLabel": {"value": "Avatar"},
        "fame": {"value": "140"},
        "date": {"value": "2009-12-10T00:00:00Z"},
        "director": {"value": "James Cameron"},
        "box": {"value": "2847379794"},
        "image": {"value": "http://commons.wikimedia.org/wiki/Special:FilePath/Avatar.jpg"},
    }
    facts = row_to_facts(row)
    kinds = {(f.get("meta") or {}).get("answer_field") or (f.get("numeric_unit") or ("year" if f["year"] else "?")) for f in facts}
    assert kinds == {"year", "box office (USD)", "director", "poster"}, kinds
    director = next(f for f in facts if (f.get("meta") or {}).get("answer_field") == "director")
    assert "James Cameron" in director["fact_text"], "answer must appear verbatim for MC blanking"
    poster = next(f for f in facts if (f.get("meta") or {}).get("answer_field") == "poster")
    assert poster["meta"]["answer"] == "Avatar" and "“Avatar”" in poster["fact_text"]
    assert row_to_facts({"item": {"value": "x/Q1"}, "fame": {"value": "1"}}) == []  # no title → nothing
    # junk year is dropped
    bad = dict(row); bad["date"] = {"value": "0005-01-01T00:00:00Z"}
    assert all(f["year"] is None for f in row_to_facts(bad)), "year guard"
    print("screen_ingest selfcheck ok")


if __name__ == "__main__":
    import sys
    if "--selfcheck" in sys.argv:
        _selfcheck()
    else:
        main()

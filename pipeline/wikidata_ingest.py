"""
wikidata_ingest.py
------------------
Wikidata SPARQL → facts across **every category**. **Keyless.**

The underused giant (§3.15): WDQS is free, no-auth, and exposes structured facts
with stable QIDs for the whole world — musicians, athletes, scientists, leaders,
paintings. §3.16 already mined *films* from WDQS for the screen category; this is
the same well, widened to backfill the thin categories (music / sports / history /
wildcard) that the keyed sources used to carry.

Two-step query pattern (inherited from screen_ingest, for the same reason):
aggregating over *all* humans times out the 20s endpoint, so we run a cheap
"top-N QIDs by fame" query per domain, then a bounded property fetch for just
those QIDs (VALUES caps the aggregation). Fame = sitelink count (how many
Wikipedia editions cover the subject) — the keyless popularity proxy.

Each domain is a DOMAIN spec (category + how to find it + how to phrase it), so
adding a category is one dict, not a new function. Per subject we emit:
- a year fact   → year_guess fuel (THE CLOCK / vague→specific clues)
- an answer fact → multiple_choice fuel (nationality / creator; answer verbatim
                   in fact_text so forge_multiple_choice can blank it)
- an image fact → image_guess fuel (P18 Commons image; MC keyed on the picture)

Run:
    python wikidata_ingest.py                  # all domains, default fame floors
    python wikidata_ingest.py --limit 150
    python wikidata_ingest.py --only music sports

Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts

WDQS = "https://query.wikidata.org/sparql"

# One spec per domain. `pred`/`target` locate subjects (P106=occupation for people,
# P31=instance-of for works); `year_prop`/`ans_prop` are the two facts we pull.
# `ans_tmpl` MUST contain "{ans}" verbatim — forge_multiple_choice blanks the
# answer out of fact_text, so the answer has to literally appear there.
DOMAINS: list[dict] = [
    {
        "key": "music", "category": "music", "pred": "wdt:P106", "target": "Q639669",  # musician
        "year_prop": "P569", "year_tmpl": "{subj} was born in {year}.",
        "ans_prop": "P27", "ans_field": "nationality",
        "ans_tmpl": "{subj} holds citizenship of {ans}.",
        "img_tmpl": "A portrait of the musician {subj}.", "img_field": "portrait",
        "year_lo": 1200, "year_hi": 2025,
    },
    {
        "key": "sports", "category": "sports", "pred": "wdt:P106", "target": "Q2066131",  # athlete
        "year_prop": "P569", "year_tmpl": "{subj} was born in {year}.",
        "ans_prop": "P27", "ans_field": "nationality",
        "ans_tmpl": "{subj} holds citizenship of {ans}.",
        "img_tmpl": "A portrait of the athlete {subj}.", "img_field": "portrait",
        "year_lo": 1850, "year_hi": 2025,
    },
    {
        "key": "history", "category": "history", "pred": "wdt:P106", "target": "Q82955",  # politician
        "year_prop": "P569", "year_tmpl": "{subj} was born in {year}.",
        "ans_prop": "P27", "ans_field": "nationality",
        "ans_tmpl": "{subj} holds citizenship of {ans}.",
        "img_tmpl": "A portrait of {subj}.", "img_field": "portrait",
        "year_lo": -800, "year_hi": 2025,
    },
    {
        "key": "science", "category": "wildcard", "pred": "wdt:P106", "target": "Q901",  # scientist
        "year_prop": "P569", "year_tmpl": "The scientist {subj} was born in {year}.",
        "ans_prop": "P27", "ans_field": "nationality",
        "ans_tmpl": "The scientist {subj} held citizenship of {ans}.",
        "img_tmpl": "A portrait of the scientist {subj}.", "img_field": "portrait",
        "year_lo": 1000, "year_hi": 2025,
    },
    {
        "key": "art", "category": "wildcard", "pred": "wdt:P31", "target": "Q3305213",  # painting
        "year_prop": "P571", "year_tmpl": "The painting “{subj}” was created in {year}.",
        "ans_prop": "P170", "ans_field": "creator",
        "ans_tmpl": "The painting “{subj}” was created by {ans}.",
        "img_tmpl": "The painting “{subj}”.", "img_field": "painting",
        "year_lo": -3000, "year_hi": 2025,
    },
]


def _val(binding: dict, key: str) -> str | None:
    """Pull a SPARQL binding's literal/URI value, or None if absent."""
    return (binding.get(key) or {}).get("value")


def _query(sparql: str) -> list[dict]:
    data = get_json(WDQS, params={"format": "json", "query": sparql})
    return data["results"]["bindings"]


def top_qids(d: dict, limit: int, min_fame: int) -> list[str]:
    """Cheapest query WDQS answers fast: subjects of one domain, ordered by fame."""
    rows = _query(
        f"SELECT ?item ?fame WHERE {{"
        f"  ?item {d['pred']} wd:{d['target']}; wikibase:sitelinks ?fame."
        f"  FILTER(?fame >= {int(min_fame)})"
        f"}} ORDER BY DESC(?fame) LIMIT {int(limit)}"
    )
    return [r["item"]["value"].rsplit("/", 1)[1] for r in rows]


def fetch_props(d: dict, qids: list[str]) -> list[dict]:
    """Bounded property fetch for the given QIDs — fast because VALUES caps the
    aggregation to len(qids) rows. Manual rdfs:label (not the label SERVICE,
    which misbinds under GROUP BY); SAMPLE for the multi-valued answer/image."""
    vals = " ".join(f"wd:{q}" for q in qids)
    return _query(
        "SELECT ?item ?itemLabel ?fame (MIN(?y) AS ?year)"
        " (SAMPLE(?ansLabel) AS ?ans) (SAMPLE(?img) AS ?image) WHERE {"
        f"  VALUES ?item {{ {vals} }}"
        '  ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel) = "en")'
        "  ?item wikibase:sitelinks ?fame."
        f"  OPTIONAL {{ ?item wdt:{d['year_prop']} ?y. }}"
        f"  OPTIONAL {{ ?item wdt:{d['ans_prop']} ?a. ?a rdfs:label ?ansLabel."
        '             FILTER(LANG(?ansLabel) = "en") }'
        "  OPTIONAL { ?item wdt:P18 ?img. }"
        "} GROUP BY ?item ?itemLabel ?fame"
    )


def row_to_facts(b: dict, d: dict) -> list[dict]:
    """One WDQS result row → 0..3 facts, mirroring the qtypes the forge expects."""
    subj = _val(b, "itemLabel")
    if not subj:
        return []
    qid = _val(b, "item").rsplit("/", 1)[1]
    url = f"https://www.wikidata.org/wiki/{qid}"
    image = _val(b, "image")  # P18 is a resolvable Special:FilePath URL
    fame = float(_val(b, "fame") or 0)
    pop = min(100.0, fame * 0.7)  # ponytail: linear fame→popularity, same as screen_ingest

    def fact(text: str, **kw) -> dict:
        return make_fact(source="wikidata", category=d["category"], subject=subj,
                         fact_text=text, image_url=image, source_url=url,
                         popularity=pop, **kw)

    out: list[dict] = []

    raw_year = _val(b, "year") or ""
    # ISO dates may lead with "-" for BCE; keep the sign, take the year field
    neg = raw_year.startswith("-")
    digits = raw_year.lstrip("-")[:4]
    if digits.isdigit():
        year = -int(digits) if neg else int(digits)
        if d["year_lo"] <= year <= d["year_hi"]:
            out.append(fact(d["year_tmpl"].format(subj=subj, year=year),
                            year=year, meta={"wikidata_id": qid}))

    ans = _val(b, "ans")
    if ans:
        # answer must appear verbatim — forge_multiple_choice blanks it from fact_text
        out.append(fact(d["ans_tmpl"].format(subj=subj, ans=ans),
                        meta={"answer_field": d["ans_field"], "answer": ans}))

    if image:
        out.append(fact(d["img_tmpl"].format(subj=subj),
                        meta={"answer_field": d["img_field"], "answer": subj}))

    return out


def run_domain(d: dict, limit: int, min_fame: int, batch: int) -> list[dict]:
    qids = top_qids(d, limit, min_fame)
    console.print(f"[cyan]{d['key']}[/cyan]: top {len(qids)} subjects by fame")
    facts: list[dict] = []
    for i in range(0, len(qids), batch):
        for b in fetch_props(d, qids[i : i + batch]):
            try:
                facts.extend(row_to_facts(b, d))
            except Exception as e:  # one bad row never kills the run
                console.print(f"[yellow]skip {_val(b, 'itemLabel')}: {e}[/yellow]")
    return facts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200, help="subjects per domain (by fame)")
    ap.add_argument("--min-fame", type=int, default=30, help="minimum sitelink count")
    ap.add_argument("--batch", type=int, default=100, help="QIDs per property query")
    ap.add_argument("--only", nargs="*", help="restrict to these domain keys")
    args = ap.parse_args()

    console.rule("[bold]Wikidata ingest (keyless, all categories)")
    domains = [d for d in DOMAINS if not args.only or d["key"] in args.only]

    facts: list[dict] = []
    for d in domains:
        facts.extend(run_domain(d, args.limit, args.min_fame, args.batch))

    dump_raw("wikidata", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


def _selfcheck() -> None:
    """Offline parse + forge-roundtrip check — no network. Proves the row→facts
    mapping honors the forge's contracts (year guard incl. BCE, verbatim answer,
    image MC) and that the facts actually forge into questions."""
    person = next(d for d in DOMAINS if d["key"] == "science")
    row = {
        "item": {"value": "http://www.wikidata.org/entity/Q937"},
        "itemLabel": {"value": "Albert Einstein"},
        "fame": {"value": "290"},
        "year": {"value": "1879-03-14T00:00:00Z"},
        "ans": {"value": "Germany"},
        "image": {"value": "http://commons.wikimedia.org/wiki/Special:FilePath/Einstein.jpg"},
    }
    facts = row_to_facts(row, person)
    fields = {(f.get("meta") or {}).get("answer_field") or ("year" if f["year"] else "?") for f in facts}
    assert fields == {"year", "nationality", "portrait"}, fields
    assert all(f["category"] == "wildcard" and f["source"] == "wikidata" for f in facts)
    nat = next(f for f in facts if (f.get("meta") or {}).get("answer_field") == "nationality")
    assert "Germany" in nat["fact_text"], "answer must appear verbatim for MC blanking"
    yr = next(f for f in facts if f["year"])
    assert yr["year"] == 1879

    # BCE date keeps its sign and passes the history floor (year_lo = -800)
    hist = next(d for d in DOMAINS if d["key"] == "history")
    bce = {"item": {"value": "x/Q1048"}, "itemLabel": {"value": "Julius Caesar"},
           "fame": {"value": "200"}, "year": {"value": "-0100-07-12T00:00:00Z"}}
    cy = next(f for f in row_to_facts(bce, hist) if f["year"])
    assert cy["year"] == -100, cy["year"]

    # no label → nothing; junk year dropped by the floor
    assert row_to_facts({"item": {"value": "x/Q1"}, "fame": {"value": "1"}}, person) == []
    junk = dict(row); junk["year"] = {"value": "0005-01-01T00:00:00Z"}  # below science year_lo
    assert all(f["year"] is None for f in row_to_facts(junk, person)), "year floor"

    # forge-roundtrip: a small wikidata batch must yield real questions
    import random
    from question_forge import forge_year_guess, forge_multiple_choice
    countries = ["Germany", "France", "Italy", "Spain", "Japan"]
    batch = []
    for i, c in enumerate(countries):
        batch += row_to_facts({
            "item": {"value": f"x/Q{i}"}, "itemLabel": {"value": f"Scientist {i}"},
            "fame": {"value": "100"}, "year": {"value": f"19{10+i}-01-01T00:00:00Z"},
            "ans": {"value": c},
        }, person)
    yqs = forge_year_guess(batch)
    assert yqs and all(q["qtype"] == "year_guess" for q in yqs), "year_guess forged"
    mcs = forge_multiple_choice(batch, random.Random(0))
    assert mcs and all("_____" in q["prompt"] and q["correct"] in q["choices"] for q in mcs), "MC forged"
    print("wikidata_ingest selfcheck ok")


if __name__ == "__main__":
    import sys
    if "--selfcheck" in sys.argv:
        _selfcheck()
    else:
        main()

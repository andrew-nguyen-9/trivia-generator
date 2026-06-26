# §3.13 Music Depth + Leak Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stop Deezer album-cover art from leaking music answers, and add 4 keyless music question recipes (label / featured-artist / genre via MC, BPM via higher_lower).

**Architecture:** A forge-time sanitizer nulls music album-cover images (fixes existing bronze offline); `music_ingest.py` emits new fact shapes that *existing* forge recipes (`forge_multiple_choice`, `forge_higher_lower`) consume — no new forge functions, no frontend changes. Tracks A and B touch disjoint files and run in parallel; integration (live/offline seed regen + full selftest) is sequential after both land.

**Tech Stack:** Python 3.11, Deezer public API (zero-auth), pytest-free `selftest.py` assertion harness.

## Global Constraints

- Owned files ONLY: `pipeline/music_ingest.py`, music parts of `pipeline/question_forge.py`, `pipeline/selftest.py`. Any other file = STOP, report as v3.0 gap.
- Scrape facts, not questions; only the forge makes questions. Keep `source_url` on every fact.
- `MIN_HL_GAP_RATIO = 0.25` (higher_lower pairs must differ ≥25%).
- `forge_multiple_choice` needs ≥4 **distinct** answers per `(category, answer_field)` and the answer must appear **verbatim** in `fact_text` (it gets masked to `_____`).
- Cover URLs contain `/images/cover/`; artist portraits contain `/images/artist/`.
- Verify with `cd pipeline && python selftest.py` (full) or `--core-only` (skips committed seed bank).

---

## Track A — `pipeline/music_ingest.py`  *(parallel agent A)*

### Task A1: Leak source fix + 4 new fact recipes

**Files:**
- Modify: `pipeline/music_ingest.py` (`facts_for_artist`)

**Interfaces:**
- Produces facts consumed downstream by the existing forge:
  - label MC: `meta={"answer_field":"label","answer":<label>}`, `fact_text` contains `<label>`
  - featured MC: `meta={"answer_field":"featured_artist","answer":<guest>}`, `fact_text` contains `<guest>`
  - genre MC: `meta={"answer_field":"genre","answer":<genre>}`, `fact_text` contains `<genre>`
  - BPM HL: `numeric_value=<bpm>`, `numeric_unit="BPM"`
- No new public function names; same `facts_for_artist(artist) -> list[dict]` signature.

- [ ] **Step 1: Fix the cover leak at source.** In the album-year fact, change `image_url=first.get("cover_xl") or pic` to `image_url=pic` (artist portrait — no title text). Add comment: `# ponytail: covers embed the title/artist as text → leaks the answer in clue mode; use the portrait`.

- [ ] **Step 2: Add the new-fact block** right after the album-count fact, still inside `if dated:`, guarded by its own try so a bad album detail never costs the core facts. Add `import re` at top if absent.

```python
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
                        source="deezer", category="music", subject=tracks[0]["title"],
                        fact_text=f"“{tracks[0]['title']}” by {name} has a tempo of {round(bpm)} BPM.",
                        numeric_value=float(bpm), numeric_unit="BPM",
                        image_url=pic, source_url=alink, popularity=pop, meta={},
                    ))
        except Exception as e:  # album/track detail is enrichment — never lose core facts
            console.print(f"[yellow]music-depth skip {name}: {e}[/yellow]")
```

- [ ] **Step 3: Sanity-compile.** Run `cd pipeline && python -c "import music_ingest"` → expect no error.

- [ ] **Step 4: Commit.**
```bash
git add pipeline/music_ingest.py
git commit -m "feat(music): strip cover-art leak + add label/genre/featured/BPM facts"
```

---

## Track B — `pipeline/question_forge.py` + `pipeline/selftest.py`  *(parallel agent B)*

### Task B1: Forge sanitizer + selftest coverage

**Files:**
- Modify: `pipeline/question_forge.py` (`forge_all`, new `_strip_leaky_music_art`)
- Modify: `pipeline/selftest.py` (`synthetic_facts`, `main`)

**Interfaces:**
- Consumes the fact contract from Task A (answer_field literals `label`/`featured_artist`/`genre`, `numeric_unit="BPM"`) — but uses its own synthetic facts, so it is independently testable.
- Produces `_strip_leaky_music_art(facts: list[dict]) -> None` (mutates in place).

- [ ] **Step 1: Add the sanitizer** to `pipeline/question_forge.py`, immediately above `def forge_all`:
```python
def _strip_leaky_music_art(facts: list[dict]) -> None:
    """Album covers embed the artist/album name as text; in a music clue
    (answer = the masked subject) that hands the answer over in the image.
    Strip cover art from music facts — keep /images/artist/ portraits (faces,
    no title text, a fair visual clue)."""
    for f in facts:
        if f.get("category") == "music" and "/images/cover/" in (f.get("image_url") or ""):
            f["image_url"] = None
```

- [ ] **Step 2: Call it** in `forge_all`, right after `assign_difficulty(facts)`:
```python
    assign_difficulty(facts)
    _strip_leaky_music_art(facts)  # §3.13: album covers leak the answer in clue mode
```

- [ ] **Step 3: Extend `synthetic_facts()`** — inside the existing `for i in range(8):` loop, append (these give 8 distinct answers per field and widely-spaced BPM):
```python
        # §3.13 music depth: label / genre / featured-artist MC + BPM higher_lower
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'Artist {i}\'s album "Album {i}" was released on the label Label {i}.',
            popularity=10.0 * i, source_url="https://example.com",
            meta={"answer_field": "label", "answer": f"Label {i}"},
        ))
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'Artist {i}\'s album "Album {i}" is categorized as Genre {i}.',
            popularity=10.0 * i, source_url="https://example.com",
            meta={"answer_field": "genre", "answer": f"Genre {i}"},
        ))
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'On the track "Song {i}", Artist {i} features Guest {i}.',
            popularity=10.0 * i, source_url="https://example.com",
            meta={"answer_field": "featured_artist", "answer": f"Guest {i}"},
        ))
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Track {i}",
            fact_text=f'"Track {i}" by Artist {i} has a tempo of {80 + i * 50} BPM.',
            numeric_value=float(80 + i * 50), numeric_unit="BPM",
            popularity=10.0 * i, source_url="https://example.com",
        ))
```

- [ ] **Step 4: Give one synthetic music fact a cover URL** so the leak guard is non-vacuous. Modify the existing "Music album year" synthetic fact (the `released the album "Album {i}"` one) to add:
```python
            image_url="https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000.jpg",
```
and add a portrait fan fact image so over-stripping is caught — add to the existing "fans on Deezer" synthetic fact:
```python
            image_url="https://cdn-images.dzcdn.net/images/artist/def/1000x1000-000.jpg",
```

- [ ] **Step 5: Add forge-output checks** in `main()`, right after the existing `check("forge produces thread", ...)` line (~L133):
```python
    mc_corrects = {q["correct"] for q in qs if q["qtype"] == "multiple_choice"}
    check("forge produces music label MC", any(c.startswith("Label ") for c in mc_corrects))
    check("forge produces music genre MC", any(c.startswith("Genre ") for c in mc_corrects))
    check("forge produces music featured-artist MC", any(c.startswith("Guest ") for c in mc_corrects))
    check("forge produces music BPM higher_lower",
          any(q["qtype"] == "higher_lower" and q.get("unit") == "BPM" for q in qs))
    music_qs = [q for q in qs if q.get("category") == "music"]
    check("forge strips album-cover art from music questions (leak)",
          all("/images/cover/" not in (q.get("image_url") or "") for q in music_qs))
    check("forge preserves music artist portraits (not over-stripped)",
          any("/images/artist/" in (q.get("image_url") or "") for q in music_qs))
```

- [ ] **Step 6: Add the seed-bank leak guard** in `main()`, inside `if seed_path.exists():`, after the year_guess leak check (~L354):
```python
        music_bank = [q for q in bank if q.get("category") == "music"]
        check("seed bank: no music image leaks the answer (no album covers)",
              all("/images/cover/" not in (q.get("image_url") or "") for q in music_bank))
```

- [ ] **Step 7: Verify core checks green** (seed bank not yet regenerated, so use `--core-only`):
```bash
cd pipeline && python selftest.py --core-only
```
Expected: all the new `✓ forge produces music … MC`, `✓ forge produces music BPM higher_lower`, `✓ forge strips album-cover art …`, `✓ forge preserves music artist portraits` lines; exit 0.

- [ ] **Step 8: Commit.**
```bash
git add pipeline/question_forge.py pipeline/selftest.py
git commit -m "feat(music): forge-time cover sanitizer + selftest coverage (§3.13)"
```

---

## Integration (sequential, after A + B land) — orchestrator

### Task C: Regenerate seed bank + full verification

- [ ] **C1: Probe Deezer reachability.** `python -c "import urllib.request,sys; urllib.request.urlopen('https://api.deezer.com/chart/0/artists?limit=1', timeout=8); print('UP')"` (non-zero/exception ⇒ DOWN).
- [ ] **C2a (if UP):** `cd pipeline && python music_ingest.py --limit 50` (populates new label/genre/featured/BPM facts + clean portraits into `data/raw/deezer.jsonl`).
- [ ] **C3: Regenerate seed bank:** `cd pipeline && python export_seed.py --from-bronze`.
- [ ] **C4: Full selftest:** `cd pipeline && python selftest.py` → all green, incl. `✓ seed bank: no music image leaks the answer`.
- [ ] **C5: Confirm new qtypes present in seed bank** (UP path): a music `higher_lower` with `unit=="BPM"` and music `multiple_choice` count increased vs. before.
- [ ] **C6: Write root-cause + outcome back into `docs/v3/PIPELINE.md §3.13`.**
- [ ] **C7: Commit bronze + seed + doc.** Report whether the live (full) or offline (leak-fix-only) path ran.

## Self-Review (done)

- Spec coverage: leak fix (A1 step1 + B1 sanitizer) ✓; 4 recipes (A1) ✓; selftest per-field + leak guards (B1) ✓; seed regen try-live-else (C) ✓; provenance `source_url` on every fact ✓.
- Placeholders: none.
- Type consistency: answer_field literals `label`/`genre`/`featured_artist` and `numeric_unit="BPM"` identical across A (real facts), B (synthetic + asserts), C. `_strip_leaky_music_art` name consistent.

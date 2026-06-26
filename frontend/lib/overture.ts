// THE OVERTURE ("Name the Intro") — pure helpers, no React, so they unit-test
// cleanly (vitest can't resolve the @/ alias, so the test imports this relatively).
//
// Data reality (v3.0 gap): the §3.22 brief assumed Deezer 30s previews are
// ingested as "name the track" rows, but the forge's ONLY audio_guess recipe
// (pipeline/question_forge.py forge_audio) emits a synthesized melody + a *year*
// answer — no track-name field, no choices, no audio_url. The track title is,
// however, recoverable from the fact's source_url (Wikipedia music slugs encode
// it: …/wiki/Ode_to_Joy). So the room derives titles here and builds the
// name-the-tune choice pool itself. If the pipeline ever grows a real preview
// recipe (audio_url + title), the room plays those clips with zero changes here.

import type { Question } from "./types";

/** Recover a track title from a fact's source_url. Returns null when no title is
 *  derivable (e.g. a future Deezer track URL), so the row drops from the pool
 *  rather than offering a garbage choice. */
export function titleFromSource(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/wiki\/([^?#]+)/);
  if (!m) return null;
  try {
    const t = decodeURIComponent(m[1]).replace(/_/g, " ").trim();
    return t.length ? t : null;
  } catch {
    return null; // malformed %-escape
  }
}

export interface TitledRow {
  q: Question;
  title: string;
}

/** The playable pool: rows that carry a derivable title. */
export function titledRows(pool: Question[]): TitledRow[] {
  const out: TitledRow[] = [];
  for (const q of pool) {
    const title = titleFromSource(q.source_url);
    if (title) out.push({ q, title });
  }
  return out;
}

/** Build a round's choices: the correct title + up to `want-1` distinct
 *  distractor titles drawn from the rest of the pool, all shuffled. `rand` keeps
 *  it deterministic (daily mode / tests). Degrades gracefully when the pool is
 *  smaller than `want` — never invents or duplicates a choice. */
export function buildChoices(
  title: string,
  otherTitles: string[],
  rand: () => number,
  want = 4,
): string[] {
  const distractors = shuffle([...new Set(otherTitles)].filter((t) => t !== title), rand);
  return shuffle([title, ...distractors.slice(0, Math.max(0, want - 1))], rand);
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

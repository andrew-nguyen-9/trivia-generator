// CLIMB OF THE INITIATE — flavor data. The Tricksters are per-rung "modifier
// archetypes" (narrative skin over the constraint that rung enforces), and the
// sigils are the grid tokens. Pure data; the logic lives in lib/ladder.ts.

export interface Trickster {
  name: string;
  archetype: string; // short role
  whisper: string; // one-line per-rung flavor
}

// The five modifiers from the spec §6. Each rung is "hosted" by one.
export const TRICKSTERS: Trickster[] = [
  { name: "Loki", archetype: "the Illusion Architect", whisper: "What looks like the pattern is the trap." },
  { name: "Dr. Chen", archetype: "the Constraint Bias", whisper: "Every value must answer to the rule." },
  { name: "Silas Crowe", archetype: "the Causal Looper", whisper: "What you chose below decides what is true here." },
  { name: "Astrid Moon", archetype: "the Transformation Lens", whisper: "Read the symbols, not the surface." },
  { name: "Prof. Marlow", archetype: "the Structural Enforcer", whisper: "No two may touch. The architecture is absolute." },
];

// Weekly framing — the Trickster who owns the week's staircase.
export const LADDER_WEEKS: string[] = [
  "The Mirror Stair — every reflection lies but one.",
  "The Folding Ascent — the steps remember where you stepped.",
  "The Hall of Lesser Gods — each landing bargains in riddles.",
  "The Inverted Climb — what rose must be read from beneath.",
  "The Glass Spiral — the way up is drawn in symbols.",
  "The Last Threshold — the architecture forbids a wrong step.",
];

// Grid sigils (Queens-style tokens). Sliced to N per grid.
export const SIGILS: string[] = [
  "the Serpent", "the Key", "the Eye", "the Moon", "the Flame",
  "the Crown", "the Veil", "the Mirror",
];

// Short glyphs for compact grid rendering (index-aligned with SIGILS).
export const SIGIL_GLYPH: string[] = ["🐍", "🗝", "👁", "🌙", "🔥", "♛", "🕯", "🪞"];

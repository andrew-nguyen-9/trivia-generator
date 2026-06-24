export type Category =
  | "history"
  | "music"
  | "sports"
  | "screen"
  | "geography"
  | "wildcard";

export type QType =
  | "multiple_choice"
  | "year_guess"
  | "higher_lower"
  | "clue"
  | "where"
  | "audio_guess"
  | "image_guess"
  | "connections"
  | "seance"
  | "ladder"
  | "thread";

export interface LadderCandidate {
  label: string;
  category: string;
  region?: string | null;
  magnitude: number;
}

/** A single note in an offline synthesized melody (Jukebox, no audio files). */
export interface Note {
  n: string; // scientific pitch, e.g. "C4", "F#5", or "rest"
  d: number; // duration in beats
}

/** One of the four hidden groups in a Connections puzzle. */
export interface ConnectionGroup {
  label: string;
  members: string[]; // exactly 4
  difficulty?: number; // 1 (easy/yellow) … 4 (tricky/purple)
}

/** One link in a THE THREAD chain. answer[n] ends with the letter answer[n+1]
 *  starts with; `link` explains why this answer ties to the master theme. */
export interface ThreadLink {
  prompt: string;
  answer: string;
  link: string; // why this answer is tied to the theme / passes to the next
}

export interface Question {
  qtype: QType;
  category: Category;
  difficulty: number; // 1-5
  prompt: string;
  correct: string;
  choices?: string[];
  year?: number;
  value_a?: number;
  value_b?: number;
  subject_a?: string;
  subject_b?: string;
  unit?: string;
  lat?: number;
  lng?: number;
  image_url?: string | null;
  source_url?: string | null;
  audio_url?: string | null; // Jukebox: streamed clip (Deezer preview)
  melody?: Note[]; // Jukebox: offline synthesized tune (no audio file)
  groups?: ConnectionGroup[]; // Connections puzzle
  clues?: string[];             // seance: ordered clue strings (vague → specific)
  candidates?: LadderCandidate[]; // ladder: comparable sibling pool
  chain?: ThreadLink[];           // thread: ordered last-letter→first-letter links
  theme?: string;                 // thread: the master theme (the final answer)
  theme_choices?: string[];       // thread: optional choices for the final guess (theme included)
}

export const CATEGORIES: Category[] = [
  "history",
  "music",
  "sports",
  "screen",
  "geography",
  "wildcard",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  history: "History",
  music: "Music",
  sports: "Sports",
  screen: "Screen",
  geography: "Geography",
  wildcard: "Wildcard",
};

// Non-color channel for category (a11y 2.14): never rely on CATEGORY_HEX alone —
// pair the colour with this suit glyph (and/or CATEGORY_LABEL) so colour-blind
// players can still tell categories apart. Single source; mirrors the card suits.
export const CATEGORY_GLYPH: Record<Category, string> = {
  history: "♦",
  music: "♥",
  sports: "♣",
  screen: "♠",
  geography: "✦",
  wildcard: "✧",
};

// hex values mirror tailwind.config.ts — used where Tailwind classes can't reach (SVG, inline glow)
export const CATEGORY_HEX: Record<Category, string> = {
  history: "#c8852a",
  music: "#b83468",
  sports: "#2d9155",
  screen: "#2b6ab5",
  geography: "#178b99",
  wildcard: "#7040a8",
};

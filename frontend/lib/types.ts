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
  | "connections";

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

// hex values mirror tailwind.config.ts — used where Tailwind classes can't reach (SVG, inline glow)
export const CATEGORY_HEX: Record<Category, string> = {
  history: "#ffb43a",
  music: "#ff4fa3",
  sports: "#3ddc84",
  screen: "#4f9dff",
  geography: "#2fd4c4",
  wildcard: "#b07aff",
};

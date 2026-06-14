// Themed decks — a deck is just a predicate over the question bank plus a
// difficulty filter, so any room can offer "play this slice" without new data.
// Keyword matching is deliberately loose (prompt OR answer contains a term).

import type { Category, Question } from "./types";

export interface Deck {
  id: string;
  name: string;
  blurb: string;
  accent: Category;
  match: (q: Question) => boolean;
}

const hasWord = (q: Question, words: string[]) => {
  const hay = `${q.prompt} ${q.correct} ${q.subject_a ?? ""} ${q.subject_b ?? ""}`.toLowerCase();
  return words.some((w) => hay.includes(w));
};

const byCategory = (cat: Category) => (q: Question) => q.category === cat;

export const DECKS: Deck[] = [
  { id: "all", name: "Full House", blurb: "Everything in the bank.", accent: "wildcard", match: () => true },
  { id: "history", name: "Time Machine", blurb: "History only.", accent: "history", match: byCategory("history") },
  { id: "music", name: "Liner Notes", blurb: "Music only.", accent: "music", match: byCategory("music") },
  { id: "sports", name: "The Locker Room", blurb: "Sports only.", accent: "sports", match: byCategory("sports") },
  { id: "screen", name: "The Big Screen", blurb: "Film & TV only.", accent: "screen", match: byCategory("screen") },
  { id: "geography", name: "Atlas", blurb: "Geography only.", accent: "geography", match: byCategory("geography") },
  {
    id: "capitals",
    name: "World Capitals",
    blurb: "Cities, countries, flags.",
    accent: "geography",
    match: (q) => q.category === "geography" && hasWord(q, ["capital", "country", "flag", "nation"]),
  },
  {
    id: "nineties",
    name: "90s Night",
    blurb: "Anything dated 1990–1999.",
    accent: "screen",
    match: (q) => (q.year ?? 0) >= 1990 && (q.year ?? 0) <= 1999,
  },
  {
    id: "modern",
    name: "This Century",
    blurb: "Events from 2000 on.",
    accent: "music",
    match: (q) => (q.year ?? 0) >= 2000,
  },
];

export function filterByDeck(questions: Question[], deckId: string): Question[] {
  const deck = DECKS.find((d) => d.id === deckId) ?? DECKS[0];
  const out = questions.filter(deck.match);
  return out.length > 0 ? out : questions; // never strand a room with an empty pool
}

export function filterByDifficulty(
  questions: Question[],
  band: "any" | "easy" | "medium" | "hard",
): Question[] {
  if (band === "any") return questions;
  const range = band === "easy" ? [1, 2] : band === "medium" ? [3, 3] : [4, 5];
  const out = questions.filter(
    (q) => q.difficulty >= range[0] && q.difficulty <= range[1],
  );
  return out.length > 0 ? out : questions;
}

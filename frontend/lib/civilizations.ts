// THE MAP is a history game cycling a daily ancient civilization. The day's
// civilization styles the antique-map frame/markers and seeds a small set of
// themed rounds — near (its region + history) AND far (modern pop culture that
// riffs on it, e.g. Egypt → "Walk Like an Egyptian"). Chosen deterministically
// by date (daySeed) so every player gets the same civilization and SSR/client
// agree (mirrors lib/themes.ts; see lib/rng.ts).

import { mulberry32 } from "./rng";
import type { LatLng } from "./geo";
import type { Question } from "./types";

export interface Civilization {
  /** stable keyword */
  key: string;
  /** display name shown on the antique frame */
  name: string;
  /** era blurb under the nameplate */
  era: string;
  /** accent hex styling the border/markers (sits alongside CATEGORY_HEX) */
  accent: string;
  /** a glyph evoking the civilization, drawn into the seal ring */
  glyph: string;
  /** the civilization's heartland — the pin truth for "place this civilization" */
  site: LatLng;
  /** the heartland's modern-name answer */
  siteName: string;
  /** themed rounds: near (its geography/history) and far (modern pop culture) */
  questions: ThemedQuestion[];
}

/** A themed multiple-choice round tied to the day's civilization. */
export interface ThemedQuestion {
  prompt: string;
  correct: string;
  choices: string[]; // includes correct; shuffled at render
}

export const CIVILIZATIONS: Civilization[] = [
  {
    key: "egyptian",
    name: "Egyptian",
    era: "c. 3100–30 BCE",
    accent: "#c8852a",
    glyph: "𓂀",
    site: { lat: 25.7, lng: 32.6 }, // Thebes / the Nile valley
    siteName: "The Nile (Egypt)",
    questions: [
      {
        prompt: "Which river was the lifeblood of ancient Egypt?",
        correct: "The Nile",
        choices: ["The Nile", "The Tigris", "The Indus", "The Yangtze"],
      },
      {
        prompt: "The 1986 hit 'Walk Like an Egyptian' was recorded by which band?",
        correct: "The Bangles",
        choices: ["The Bangles", "Blondie", "The Go-Go's", "ABBA"],
      },
    ],
  },
  {
    key: "roman",
    name: "Roman",
    era: "c. 753 BCE–476 CE",
    accent: "#a83232",
    glyph: "☩",
    site: { lat: 41.9, lng: 12.5 }, // Rome
    siteName: "Rome (Italy)",
    questions: [
      {
        prompt: "On how many hills was the city of Rome traditionally founded?",
        correct: "Seven",
        choices: ["Seven", "Three", "Twelve", "Five"],
      },
      {
        prompt: "Which 2000 film follows a betrayed Roman general turned gladiator?",
        correct: "Gladiator",
        choices: ["Gladiator", "Troy", "300", "Ben-Hur"],
      },
    ],
  },
  {
    key: "maya",
    name: "Maya",
    era: "c. 2000 BCE–1500 CE",
    accent: "#2d9155",
    glyph: "𓏤",
    site: { lat: 17.2, lng: -89.6 }, // Tikal, Petén
    siteName: "Tikal (Guatemala)",
    questions: [
      {
        prompt: "Maya civilization is centered on which modern region?",
        correct: "Mesoamerica",
        choices: ["Mesoamerica", "The Andes", "The Levant", "The Sahel"],
      },
      {
        prompt: "A misread Maya calendar fueled doomsday hype about which year?",
        correct: "2012",
        choices: ["2012", "1999", "2000", "2020"],
      },
    ],
  },
  {
    key: "mesopotamian",
    name: "Mesopotamian",
    era: "c. 3500–539 BCE",
    accent: "#b8862e",
    glyph: "𒀭",
    site: { lat: 32.5, lng: 44.4 }, // Babylon, between the rivers
    siteName: "Babylon (Iraq)",
    questions: [
      {
        prompt: "Mesopotamia lay between the Tigris and which other river?",
        correct: "The Euphrates",
        choices: ["The Euphrates", "The Jordan", "The Nile", "The Ganges"],
      },
      {
        prompt: "Which wonder is the legendary terraced garden of this region?",
        correct: "Hanging Gardens of Babylon",
        choices: [
          "Hanging Gardens of Babylon",
          "Colossus of Rhodes",
          "Lighthouse of Alexandria",
          "Temple of Artemis",
        ],
      },
    ],
  },
  {
    key: "greek",
    name: "Greek",
    era: "c. 800–146 BCE",
    accent: "#2b6ab5",
    glyph: "Ω",
    site: { lat: 37.97, lng: 23.72 }, // Athens
    siteName: "Athens (Greece)",
    questions: [
      {
        prompt: "Which Athenian temple crowns the Acropolis?",
        correct: "The Parthenon",
        choices: ["The Parthenon", "The Pantheon", "The Colosseum", "Hagia Sophia"],
      },
      {
        prompt: "Disney's 1997 animated 'Hercules' draws on which mythology?",
        correct: "Greek",
        choices: ["Greek", "Norse", "Egyptian", "Roman"],
      },
    ],
  },
  {
    key: "indus",
    name: "Indus Valley",
    era: "c. 3300–1300 BCE",
    accent: "#7040a8",
    glyph: "卐",
    site: { lat: 27.3, lng: 68.1 }, // Mohenjo-daro
    siteName: "Mohenjo-daro (Pakistan)",
    questions: [
      {
        prompt: "The Indus Valley civilization is named for a river in which region?",
        correct: "South Asia",
        choices: ["South Asia", "North Africa", "Central Europe", "East Asia"],
      },
      {
        prompt: "Indus cities like Mohenjo-daro are famous for early planned what?",
        correct: "Sewerage / drainage",
        choices: [
          "Sewerage / drainage",
          "Suspension bridges",
          "Aqueducts to Rome",
          "Steam engines",
        ],
      },
    ],
  },
  {
    key: "chinese",
    name: "Ancient Chinese",
    era: "c. 1600 BCE–220 CE",
    accent: "#b83468",
    glyph: "龍",
    site: { lat: 34.3, lng: 108.9 }, // Xi'an, Wei valley
    siteName: "Xi'an (China)",
    questions: [
      {
        prompt: "The Terracotta Army guards the tomb of China's first what?",
        correct: "Emperor",
        choices: ["Emperor", "Pope", "Pharaoh", "Caliph"],
      },
      {
        prompt: "Which barrier was built to defend ancient China's northern frontier?",
        correct: "The Great Wall",
        choices: ["The Great Wall", "Hadrian's Wall", "The Berlin Wall", "The Maginot Line"],
      },
    ],
  },
];

/** The Secret Order character who hosts THE MAP (see GAMES.md character canon). */
export const MAP_HOST = {
  name: "The Cartographer",
  title: "Well-Travelled Explorer of the Order",
};

/** Deterministic civilization of the day — same dayIndex ⇒ same civ for everyone. */
export function pickCivilization(dayIndex: number): Civilization {
  const rand = mulberry32(0xc1f1 ^ dayIndex);
  return CIVILIZATIONS[Math.floor(rand() * CIVILIZATIONS.length)];
}

/** A themed round becomes a renderable Question (place-the-site as `where`,
 *  tangential trivia as `multiple_choice`) tied to the day's civilization. */
export function civRounds(civ: Civilization): Question[] {
  const place: Question = {
    qtype: "where",
    category: "history",
    difficulty: 2,
    prompt: `Place the ${civ.name} civilization — drop a pin on its heartland.`,
    correct: civ.siteName,
    lat: civ.site.lat,
    lng: civ.site.lng,
    source_url: null,
  };
  const tangents: Question[] = civ.questions.map((q) => ({
    qtype: "multiple_choice",
    category: "history",
    difficulty: 2,
    prompt: q.prompt,
    correct: q.correct,
    choices: q.choices,
    source_url: null,
  }));
  return [place, ...tangents];
}

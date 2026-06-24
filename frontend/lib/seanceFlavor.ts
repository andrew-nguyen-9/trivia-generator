// The Séance — weekly Spirit packs. Pure flavor data: a rotating cast of spirits,
// each supplying the occult entity categories + value name pools the engine maps
// onto its logic grid. The week picks the Spirit (the weekly narrative arc);
// the weekday picks the grid size (Mon intro → Sun exorcism). No logic here —
// see lib/seance.ts.

export interface FlavorCategory {
  key: string;
  label: string;   // singular noun, e.g. "relic"
  values: string[]; // >= 8 thematic names (engine slices N of them)
}

export interface SpiritPack {
  name: string;       // the weekly spirit
  backstory: string;  // one line of atmosphere
  categories: FlavorCategory[]; // >= 4 (engine slices cats of them)
}

// Each pack: 4 categories x 8 values. The engine slices N values and `cats`
// categories per day, so the same spirit reads differently across its week.
export const SPIRIT_PACKS: SpiritPack[] = [
  {
    name: "The Drowned Bride",
    backstory:
      "Wed to the tide, she returns each year to seat the guests who let her sink.",
    categories: [
      { key: "guest", label: "guest", values: ["Mr. Vane", "Lady Crale", "the Verger", "Dr. Ash", "Miss Wren", "the Boatman", "Aunt Pell", "the Coroner"] },
      { key: "relic", label: "relic", values: ["a salt ring", "a wedding veil", "a brass key", "a tide clock", "a drowned locket", "a black pearl", "a torn glove", "a cracked mirror"] },
      { key: "sin", label: "sin", values: ["envy", "silence", "greed", "cowardice", "betrayal", "pride", "neglect", "false witness"] },
      { key: "doom", label: "fate", values: ["the undertow", "the fever", "the rope", "the long fall", "the cold", "the debt", "the fire", "the knife"] },
    ],
  },
  {
    name: "The Hollow Tutor",
    backstory:
      "He marked his pupils in red and was buried in chalk. The lesson is not finished.",
    categories: [
      { key: "pupil", label: "pupil", values: ["Tomkin", "the Prefect", "Greer", "little Iris", "the Scholar", "Bex", "the Latecomer", "Quill"] },
      { key: "subject", label: "subject", values: ["anatomy", "rhetoric", "alchemy", "cartography", "theology", "astronomy", "cipher", "elegy"] },
      { key: "grade", label: "mark", values: ["a black star", "a red line", "a gold seal", "a torn page", "a question mark", "a blot", "a cross", "a dog-ear"] },
      { key: "room", label: "room", values: ["the cellar", "the bell tower", "the library", "the long hall", "the cloister", "the attic", "the chapel", "the gate"] },
    ],
  },
  {
    name: "The Carnival Twin",
    backstory:
      "One twin still rides the carousel. The painted horses know which one.",
    categories: [
      { key: "rider", label: "rider", values: ["the Ringmaster", "Madame Fa", "the Strongman", "the Clown", "the Acrobat", "the Fortune Teller", "the Ticket Boy", "the Lion Tamer"] },
      { key: "horse", label: "mount", values: ["the white mare", "the cracked steed", "the gilt pony", "the black stallion", "the lame foal", "the painted nag", "the swan", "the dragon"] },
      { key: "ticket", label: "token", values: ["a red stub", "a bent coin", "a paper rose", "a glass eye", "a melted candy", "a brass ring", "a torn flag", "a feather"] },
      { key: "tune", label: "tune", values: ["the waltz", "the dirge", "the march", "the lullaby", "the reel", "the hymn", "the jig", "the requiem"] },
    ],
  },
  {
    name: "The Frostbound Captain",
    backstory:
      "His ship never thawed. He counts the crew that ate the last of the lamp oil.",
    categories: [
      { key: "crew", label: "crew", values: ["the Bosun", "Cook", "the Surgeon", "young Pike", "the Navigator", "the Stowaway", "the Chaplain", "the Mate"] },
      { key: "ration", label: "ration", values: ["the last biscuit", "lamp oil", "salt pork", "a frozen orange", "the rum", "boot leather", "the seed grain", "ink"] },
      { key: "post", label: "post", values: ["the crow's nest", "the galley", "the hold", "the helm", "the bow", "the brig", "the rigging", "the cabin"] },
      { key: "omen", label: "omen", values: ["a green light", "a cracked compass", "the white whale", "a black gull", "the aurora", "a knocking hull", "a frozen rope", "a silent bell"] },
    ],
  },
  {
    name: "The Clockmaker's Widow",
    backstory:
      "She wound every clock in the house to the minute he died. They have not stopped.",
    categories: [
      { key: "heir", label: "heir", values: ["the Nephew", "Cousin Marl", "the Maid", "the Solicitor", "the Apprentice", "the Debtor", "the Vicar", "the Stranger"] },
      { key: "clock", label: "clock", values: ["the longcase", "the cuckoo", "the carriage clock", "the sundial", "the hourglass", "the pocket watch", "the water clock", "the alarm"] },
      { key: "hour", label: "hour", values: ["midnight", "the first hour", "noon", "the witching hour", "dawn", "dusk", "the eleventh hour", "the lost minute"] },
      { key: "motive", label: "motive", values: ["the inheritance", "an old grudge", "a hidden letter", "a broken vow", "jealousy", "fear of ruin", "a secret child", "mercy"] },
    ],
  },
  {
    name: "The Garden of Ash",
    backstory:
      "Nothing grows where she walked. The gardeners still smell the smoke at dusk.",
    categories: [
      { key: "tender", label: "tender", values: ["the Head Gardener", "the Botanist", "old Mott", "the Heiress", "the Beekeeper", "the Groundsman", "the Florist", "the Boy"] },
      { key: "bloom", label: "bloom", values: ["nightshade", "the black rose", "ash-lily", "wolfsbane", "the grey iris", "deadnettle", "the weeping fern", "smoke orchid"] },
      { key: "plot", label: "plot", values: ["the east bed", "the maze", "the greenhouse", "the orchard", "the pond", "the grotto", "the hedge", "the ruin"] },
      { key: "tool", label: "tool", values: ["the rusted shears", "a bone trowel", "the watering can", "a coil of wire", "the pruning hook", "a glass bell", "the spade", "a paper of seeds"] },
    ],
  },
];

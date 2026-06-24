# PARLOR v2 — Design System

The visual language of v2, derived from the brand seal. Owns Phase 2.2 and
constrains every visual phase after it. Pairs with `PLATFORM.md` §2.14 (a11y) and
§2.15 (light/dark).

## The seal (`.logo/Logo V10 - Secret Order`)

Decode the logo into a reusable language:

- **Spade** — the playing-card core. Every game is a card; the deck is the home.
- **All-seeing eye** — the watcher. The Mystery's emblem; the sense of being
  observed in a wealthy, slightly haunted house.
- **Candle flame** — warmth and ritual. Literally the Streak mechanic (2.6); the
  recurring light source in the dark theme.
- **Question-mark tail** — trivia itself.
- **Occult glyph ring** — arcane knowledge, travel, antiquity. The Map's
  civilization ring (2.7); decorative borders.
- **Engraving / cross-hatch** — Victorian banknote etching. The line treatment for
  borders, dividers, card frames.

Mood: **a haunted, wealthy, well-travelled Victorian mansion** — brass, velvet,
parchment, candle-glow, antiquarian maps, curiosity cabinets. Mysterious and
intriguing, never "nightlife."

## Palette

The existing Tailwind tokens (`frontend/tailwind.config.ts`) already match the seal.
v2 keeps them and assigns **semantic roles** so light/dark can remap cleanly.

| Token | Hex | Semantic role |
|---|---|---|
| `bg` | `#150409` | surface-base (dark) |
| `surface` | `#24101a` | raised panel |
| `line` | `#4a2233` | hairline / engraving |
| `ink` | `#f0e6cf` | primary text |
| `muted` | `#9a7a78` | secondary text |
| `brass` | `#a87a2e` | accent / ornament |
| `gold` | `#c9a24a` | primary highlight |
| `goldlite` | `#e6c878` | shine |
| `candle` | `#f5c542` | flame / focus glow |
| `ember` | `#d4431e` | danger / heat |
| `burgundy` | `#6e1f2b` | the eye / hero glow |
| `parchment` | `#efe8c0` | light surface |

**Category jewels** (keep, single source in `lib/types.ts` `CATEGORY_HEX`): history
`#c8852a`, music `#b83468`, sports `#2d9155`, screen `#2b6ab5`, geography `#178b99`,
wildcard `#7040a8`. **a11y rule (2.14): never encode category by color alone** —
pair with a suit/glyph/label.

## Typography

Cinzel (display, already wired via `next/font`) for headings + nameplates; a
readable serif/text companion for body and questions. Type scale and contrast take
cues from the reference sites (below) — large confident display, generous line
height for questions. Legibility of questions/answers is non-negotiable and overrides
any effect (esp. the Streak flame, 2.6).

## The card-deck system (Phase 2.2 home)

The home page becomes **a deck of cards** — one **unique card per game**:

- **Card face** — each game gets bespoke face art built from the seal's motif
  vocabulary (its suit + a Secret Order character + the game's icon), in the
  engraving style. A shared frame, unique interior.
- **Card-trick motion vocabulary** (reused by the 404, 2.19):
  - *Deal-in* on load (cards fly to the grid).
  - *Hover* lift + slight 3D tilt; *flip* to reveal the blurb (the existing
    `flip-scene`/`flip-inner` CSS is the seed).
  - *Fan / spread*, *shuffle*, *riffle* as idle/interaction flourishes.
  - *Magical shapes* — on specific actions, cards arrange into shapes (spade,
    constellation) before settling.
- **Contract** — a `Card` component: `{ game, suit, character, faceArt, blurb }`;
  motion driven by Framer Motion with a **reduced-motion path** (static deal, no
  perpetual animation) per 2.14.

## "Haunted Victorian mansion" mood + imagery

- **Textures**: parchment, brass plate, oxblood velvet, candle bloom, antique map
  paper, etched glass (the Wedges mirror, 2.5).
- **Unsplash (req #11)**: source atmospheric imagery (mansion interiors, antique
  maps, candlelight, curiosities, ancient sites for the Map) via Unsplash. Add the
  Unsplash CDN to `next.config.mjs` `remotePatterns`; always lazy-load, size
  explicitly (`next/image`), prefer duotone/treated stills so photos read as
  engravings, not stock. Keep counts low (perf, 2.16).

## Reference-site learnings (req #10)

Distill, don't clone. What to take from each:

| Site | Take |
|---|---|
| trionn.com | Confident motion choreography; restrained, premium feel |
| everswap.com | Crisp depth + spatial layering on dark surfaces |
| aorum.io | Luxe minimalism; gold-on-dark restraint; type scale |
| fanalis.in | Editorial layout rhythm; whitespace as luxury |
| andreigorskikh.digital | Bold display type + cursor-reactive motion (feeds Streak's cursor glow, 2.6) |
| coveomusic.com | Audio-reactive / atmospheric texture ideas |
| wearedaima.framer.website | Playful card/section transitions; section choreography |

Common thread: **restraint + intentional motion**. v2 must not read templated. Every
animation earns its place; nothing loops for the sake of looping (also a perf win).

## Light / Dark (req #12, formalized in PLATFORM §2.15)

Today the app forces dark. v2 ships both:

- **Dark** = "the mansion by candlelight" (the current oxblood/gold/candle world).
- **Light** = "a daylit tour" — parchment surfaces, brass + burgundy ink, gold
  reserved for accents. Remap the semantic roles, not the brand.
- System preference by default + a manual toggle; persisted; **SSR-safe** (no flash;
  obey `lib/rng.ts` SSR rules — no `Math.random()` in render paths).

## Claude Design tooling (the visual loop)

Every visual phase runs the same loop:

1. **Draft** — `import-claude-design-from-url` (Vercel Claude Design) or the Figma
   `figma-generate-design` skill to draft card faces / room layouts from the seal +
   reference-site cues. `DesignSync` to pull a design into code.
2. **Build** — the `frontend-design` / `ce-frontend-design` skills for
   implementation that isn't AI-slop.
3. **Verify** — `chrome-devtools` `lighthouse_audit` (perf + a11y scores) and
   `performance_*` traces; `playwright` for cross-browser + mobile snapshots.
   Screenshot-diff before declaring a visual phase done.

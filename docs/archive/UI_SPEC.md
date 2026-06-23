# UI Spec — PARLOR

## Creative direction

PARLOR is an **after-dark house of games**: a near-black stage, one huge condensed
headline per screen, electric category colors used like neon signage, and constant
small motion. Distilled from the inspiration sites:

| Site | What we stole |
|---|---|
| storytelling.noomoagency.com | cinematic dark stage, one-idea-per-screen pacing, slow glow gradients |
| apechain.com | loud flat color blocks, chunky borders, marquee tickers, sticker energy |
| serverobotics.com / vaulk.com | disciplined grid, generous whitespace *inside* the chaos, precise micro-type labels |
| hubtown-live.netlify.app | playful tilted cards, hover wobble, "place made of rooms" navigation metaphor |
| steven.com / trucknroll.com | oversized numerals, scroll-snapping sections, tactile button states |
| hashgraphvc.com | grain/noise overlay on dark, restrained accent glow |

## Design tokens (`globals.css` + `tailwind.config.ts`)

```
--bg          #0a0a0f   near-black stage
--surface     #141420   card base
--line        #26263a   hairlines
--ink         #f5f3ee   warm off-white text
--muted       #8b8b9e

Category neon (also the wedge palette):
--history     #ffb43a   amber
--music       #ff4fa3   magenta
--sports      #3ddc84   green
--screen      #4f9dff   blue
--geography   #2fd4c4   teal
--wildcard    #b07aff   violet
```

- **Display type:** ultra-bold condensed, uppercase, tight tracking — implemented as
  `font-stretch`/weight on the system stack (no build-time font fetch; works offline).
  Hero sizes use `clamp(3rem, 12vw, 9rem)`.
- **Label type:** 11px uppercase letterspaced "micro-labels" (the vaulk/serve trick)
  for everything secondary: `tracking-[0.2em] text-xs uppercase text-muted`.
- **Grain:** fixed full-screen SVG noise overlay at ~4% opacity (`NoiseOverlay`).
- **Glow:** each room page gets one blurred radial blob in its category color,
  slowly drifting (CSS animation, paused under `prefers-reduced-motion`).

## Signature components

| Component | Behavior |
|---|---|
| `Marquee` | infinite horizontal ticker of fun facts on home; pauses on hover |
| `RoomCard` | home navigation: huge numbered card, tilts ±2° on hover (hubtown), category-colored border-glow |
| `BoardCell` | Jeopardy cell: flips 3D on select (`rotateY`), gold value numerals |
| `YearSlider` | the Clock's giant year readout (tabular-nums, 8vw) + draggable track with spring snap on release |
| `WedgeRing` | six-segment SVG ring showing collected wedges, segment fills with a pop |
| `StreakCards` | two stacked metric cards; reveal animates the hidden number counting up |
| `ScorePill` | persistent top-right score, count-up animation on change |

## Motion rules

- Page enter: section content rises 12px + fades, 0.4s stagger (Framer Motion).
- Card flips/reveals: 0.5s `rotateY` with backface hidden.
- Number reveals: count-up over 0.6s, ease-out.
- Everything checks `useReducedMotion()` — reduced = opacity-only, no transforms.

## Layout rules

- Home is a vertical scroll of full-height snap sections: title stage → marquee →
  the four room cards → footer colophon (data sources credited — required by
  TMDB/OpenTDB attribution terms).
- Rooms are single-screen apps (no scroll during play) with the room label
  micro-type top-left, ScorePill top-right, exit door bottom-left ("← LOBBY").
- Mobile-first: every room playable one-handed; board collapses to category
  accordion under 640px.

## Accessibility

- All interactive cells are real `<button>`s; focus rings in category color.
- Color is never the only signal (wedges also show ✓; correct/incorrect states
  pair color with icon + text).
- Year slider operable by keyboard (arrows = ±1, shift+arrows = ±10) and has a
  numeric input fallback.

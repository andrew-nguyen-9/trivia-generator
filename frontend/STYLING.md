# PARLOR styling convention (v3 §3.0)

`app/globals.css` is **frozen after §3.0**. It holds only:

- the Tailwind layers,
- the semantic **theme tokens** (`--c-*`, light/dark) and the shared
  **desktop-density tokens** (`--d-gutter`, `--d-maxw`, `--d-col-gap`,
  `--d-card-min`, `--d-stack`) plus the `.density-grid` helper,
- genuinely global element/utility styles (`.display`, `.microlabel`, the glow,
  page transitions, etc.).

**Per-component styling lives in a colocated `*.module.css`**, imported by the
component:

```tsx
import styles from "./Overture.module.css";
// ...
<div className={styles.panel} />
```

## Why

So later v3 segments **never edit `globals.css`** (a shared file). A game owns
its `*.module.css`; CSS Modules scope class names locally, so two segments can
ship in parallel with zero conflict in the global stylesheet. Adding a token to
`globals.css` is a §3.0 follow-up, not in-segment work.

## Rules

1. Reach for Tailwind utilities first. Drop to a `*.module.css` when you need
   real CSS (keyframes, complex selectors, `clamp()` layout, container queries).
2. Reference the shared tokens (`var(--d-gutter)`, `rgb(var(--c-brass))`) — do
   not hard-code spacing/colour that a token already names.
3. Name the file after the component (`AudioRoom.module.css` ↔ `AudioRoomGame`)
   and colocate it next to the component or route page.
4. No new globals. If you think you need one, it's a §3.0 change — flag it.

Examples in tree: `app/overture/coming-soon.module.css`,
`app/cold-case/coming-soon.module.css`.

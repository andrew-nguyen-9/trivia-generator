# CANON — The Secret Order of the Curious

> Owned by **2.11 — The Mystery** (the canon hub). This is the single source of
> the Parlor's cast. Every room references the Order; the Mystery is where the
> Order convenes. Keep this file in sync when a tie-in lands.

## The premise

The Parlor is the meeting house of **the Secret Order of the Curious** — an
invitation-only society of nine who keep the games. Each member presides over
one room. The Mystery is the night they all gather around the all-seeing eye
(𓂀) to solve a death; its rotating ensemble of suspects is drawn from the
Parlor's wider world, not the Order itself.

## The one-reference rule

**Each game carries exactly one canon reference — a nod, never a takeover.**

- One member's voice/title/emblem per room. Not a cast, not a cutscene.
- The reference is flavor on an existing surface (a header microlabel, an empty
  state, a result line) — it never gates play or adds a dependency.
- The Mystery is the sole exception: it is the Order assembled, so it may name
  the whole roster.

## The Order — nine members, one per room

| Room (phase) | Member | Emblem | Voice / one-line |
|---|---|---|---|
| Board (2.3) | **The Host** | ♠ | Master of ceremonies; deals the board, keeps the wager. |
| Clock (2.4) | **The Clockkeeper** | ⏳ | Tends the hours; every year has its place. |
| Wedges (2.5) | **The Ghost** | 👻 | The wedge that haunts the ring; never quite leaves. |
| Streak (2.6) | **The Witch** | 🔮 | Reads the run of luck; dares you to push it. |
| Map (2.7) | **The Cartographer** | 🧭 | Charts the world from the parlor; never wrong by much. |
| Thread (2.8) | **The Weaver** | 🧵 | Spins one answer into the next; the chain is the point. |
| Séance (2.9) | **The Medium** | 🕯 | Channels the departed; speaks in riddle and period voice. |
| Ladder (2.10) | **The Trickster** | 🜍 | Illusionist of the Order; the obvious step is the trap. |
| Gauntlet (2.12) | **The Adventurer** | 𖣘 | Relic-hunter; runs the temple, races the clock. |
| **Mystery (2.11)** | **the full Order** | 𓂀 | They convene under the eye. The roster + this rule live here. |

*(Wedges' "Ghost" and Ladder's "Trickster" emblems are placeholders — finalize
the glyph when each tie-in is wired.)*

## The Mystery ensemble (rotating cast)

The Mystery's suspects/victims are the **ROSTER** in `frontend/lib/mystery.ts`
(20 characters; 8 are dealt per night). These are Parlor regulars, distinct from
the nine Order members above. The roster is the property of the Mystery and is
referenced wholesale only there.

## Tie-in checklist

`[x]` = the room shows its one reference. `[ ]` = not yet wired.

- [ ] Board → The Host
- [ ] Clock → The Clockkeeper
- [ ] Wedges → The Ghost
- [ ] Streak → The Witch
- [ ] Map → The Cartographer
- [ ] Thread → The Weaver
- [ ] Séance → The Medium
- [ ] Ladder → The Trickster
- [ ] Gauntlet → The Adventurer
- [x] Mystery → the full Order (𓂀 eye motif + the assembled roster)

When wiring a tie-in: add the single reference to that room's component, then
tick its box here. Do not exceed one reference per room.

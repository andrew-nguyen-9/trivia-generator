import Link from "next/link";
import { roomMetadata } from "@/lib/rooms";

export const metadata = roomMetadata("/about");

// A short article of lore + plain truth. Mystery framing on top, an honest
// "what this actually is" underneath — the Order keeps secrets, not lies.
const TENETS = [
  {
    glyph: "♠",
    title: "The deck is the house",
    body: "Every game is a card; the lobby is the deck. Draw one and a room opens — a board, a map, a séance, a murder. The same cards, dealt fresh each night.",
  },
  {
    glyph: "◉",
    title: "The eye is always open",
    body: "Each dusk the Order lays out a new case. Read the dossiers, weigh the alibis, follow the evidence, and name the culprit before the candle gutters out.",
  },
  {
    glyph: "❡",
    title: "Nothing here is invented",
    body: "Questions are forged nightly from real records — encyclopaedias, music libraries, sporting ledgers, film archives, the atlas itself. Every answer carries a source.",
  },
  {
    glyph: "✦",
    title: "Admission is free, the secret is not",
    body: "No accounts, no walls. Your streaks and badges live on your own machine. The house keeps only one thing close: the answer, until you have earned it.",
  },
];

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-24 pt-10 sm:px-8">
      <div className="glow" style={{ background: "#6e1f2b" }} aria-hidden />

      <header className="relative z-10 mx-auto max-w-3xl">
        <Link href="/" className="microlabel text-brass transition hover:text-gold">
          ← the lobby
        </Link>

        <div className="mt-10 flex flex-col items-center text-center">
          <img
            src="/logo-256.png?v=2"
            alt="The Secret Order seal"
            width={104}
            height={114}
            className="eye-glow mb-5 h-24 w-auto drop-shadow-[0_6px_30px_rgba(110,31,43,0.5)]"
          />
          <p className="microlabel mb-3 tracking-[0.3em] text-brass">
            ✦ &nbsp; the secret order &nbsp; ✦
          </p>
          <h1 className="gilt display text-[clamp(2.6rem,9vw,5rem)] leading-none">
            About the Parlor
          </h1>
        </div>
      </header>

      <article className="relative z-10 mx-auto mt-12 max-w-2xl space-y-6 text-base leading-relaxed text-ink/90">
        <p>
          There is a house at the end of a street that is not on any map you own.
          Brass fittings, oxblood velvet, candle-smoke in the drapes, and on every
          wall the same engraved mark: a flaming spade beneath a watchful eye. The
          people who meet here call themselves <em>the Secret Order of the
          curious</em>, and they meet for one reason — to find out who knows the
          most, and who can be fooled.
        </p>
        <p>
          <strong className="text-gold">PARLOR</strong> is that house, rendered for
          the web. It is ten rooms behind one velvet door: a daily board, a clock
          you wind back through the century, a shattered-mirror quickfire, a candle
          you keep lit on a streak, an antique map with a pin to drop, and — the
          feature card of the deck — a fresh murder to solve every night.
        </p>
        <div className="my-10 flex items-center gap-3" aria-hidden>
          <div className="h-px flex-1 bg-line" />
          <span className="text-brass opacity-50">♠ ◆ ♣ ♥</span>
          <div className="h-px flex-1 bg-line" />
        </div>
      </article>

      <section className="relative z-10 mx-auto grid max-w-3xl gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {TENETS.map((t) => (
          <div key={t.title} className="bg-bg/60 p-6 backdrop-blur">
            <span className="text-2xl text-gold" aria-hidden>
              {t.glyph}
            </span>
            <h2 className="display mt-3 text-lg text-ink">{t.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.body}</p>
          </div>
        ))}
      </section>

      <div className="relative z-10 mx-auto mt-14 max-w-2xl text-center">
        <p className="text-sm text-muted">
          The candle is lit. A card is waiting to be dealt.
        </p>
        <Link
          href="/"
          className="microlabel mt-5 inline-flex items-center gap-2 rounded-full border border-brass px-6 py-3 text-gold transition hover:bg-brass/10"
        >
          draw a card →
        </Link>
      </div>
    </main>
  );
}

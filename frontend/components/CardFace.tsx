import { CATEGORY_HEX, type Category } from "@/lib/types";

export type Game = {
  href: string;
  name: string;
  accent: Category;
  character: string;
  emblem: string;
  rank: number; // 1 = Ace
  blurb: string;
};

const SUIT: Record<Category, string> = {
  history: "♦",
  music: "♥",
  sports: "♣",
  screen: "♠",
  geography: "✦",
  wildcard: "✧",
};

// Canonical French-deck pip coordinates (% of the pip field) for ranks 2–10.
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 10], [50, 90]],
  3: [[50, 10], [50, 50], [50, 90]],
  4: [[30, 12], [70, 12], [30, 88], [70, 88]],
  5: [[30, 12], [70, 12], [50, 50], [30, 88], [70, 88]],
  6: [[30, 11], [70, 11], [30, 50], [70, 50], [30, 89], [70, 89]],
  7: [[30, 11], [70, 11], [50, 30], [30, 50], [70, 50], [30, 89], [70, 89]],
  8: [[30, 11], [70, 11], [50, 30], [30, 50], [70, 50], [50, 70], [30, 89], [70, 89]],
  9: [[30, 9], [70, 9], [30, 36], [70, 36], [50, 50], [30, 64], [70, 64], [30, 91], [70, 91]],
  10: [[30, 9], [70, 9], [50, 27], [30, 36], [70, 36], [30, 64], [70, 64], [50, 73], [30, 91], [70, 91]],
};

const rankLabel = (r: number) => (r === 1 ? "A" : String(r));

// Larger when there are fewer pips, smaller when more — so every card is full
// but never crowded.
const pipRem = (count: number) =>
  count <= 2 ? 3 : count <= 3 ? 2.6 : count <= 5 ? 2.2 : count <= 6 ? 1.9 : count <= 8 ? 1.6 : 1.4;

function Corner({ game, corner }: { game: Game; corner: "tl" | "br" }) {
  const hex = CATEGORY_HEX[game.accent];
  return (
    <span
      className={`absolute z-[2] flex flex-col items-center leading-none ${
        corner === "tl" ? "left-3.5 top-3" : "bottom-3 right-3.5 rotate-180"
      }`}
    >
      <span className="display text-base" style={{ color: "#43141f" }}>
        {rankLabel(game.rank)}
      </span>
      <span className="text-sm" style={{ color: hex }} aria-hidden>
        {SUIT[game.accent]}
      </span>
    </span>
  );
}

export default function CardFace({
  game,
  side = "front",
  zoomed = false,
}: {
  game: Game;
  side?: "front" | "back";
  zoomed?: boolean;
}) {
  const hex = CATEGORY_HEX[game.accent];

  if (side === "back") {
    return (
      <div className="deck-face deck-back-art">
        <span className="deck-corner-flourish deck-corner-tl" aria-hidden>✦</span>
        <span className="deck-corner-flourish deck-corner-br" aria-hidden>✦</span>
        <span className="deck-back-ring" aria-hidden />
        {/* The detailed Secret Order seal — never the white silhouette. */}
        <img src="/logo-256.png" alt="" aria-hidden className="deck-back-seal eye-glow" />
      </div>
    );
  }

  const isAce = game.rank === 1;
  const pips = PIPS[game.rank] ?? [];

  return (
    <div className="deck-face deck-front">
      <Corner game={game} corner="tl" />
      <Corner game={game} corner="br" />

      {/* corner filigree, four quarters */}
      <span className="deck-corner-flourish deck-corner-tr" aria-hidden>❧</span>
      <span className="deck-corner-flourish deck-corner-bl" aria-hidden>❧</span>

      {isAce ? (
        // The Ace: one grand central emblem inside an ornate ring.
        <div className="deck-ace" aria-hidden>
          <span className="deck-ace-ring" />
          <span className="deck-ace-emblem" style={{ fontSize: zoomed ? "8rem" : "4.6rem" }}>
            {game.emblem}
          </span>
        </div>
      ) : (
        <div className="deck-pips" aria-hidden>
          {pips.map(([x, y], i) => (
            <span
              key={i}
              className="deck-pip"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                fontSize: `${pipRem(game.rank) * (zoomed ? 1.7 : 1)}rem`,
              }}
            >
              {game.emblem}
            </span>
          ))}
        </div>
      )}

      <div className={`deck-cartouche${zoomed ? " deck-cartouche-zoom" : ""}`}>
        <span className="deck-cart-character microlabel block" style={{ color: hex }}>
          {game.character}
        </span>
        <span
          className={`deck-cart-name display block ${zoomed ? "text-[clamp(1.5rem,5vw,2.1rem)]" : "text-base"}`}
          style={{ color: "#43141f" }}
        >
          {game.name}
        </span>
        {zoomed && (
          <p className="deck-cart-blurb" style={{ color: "#5a2230" }}>
            {game.blurb}
          </p>
        )}
      </div>
    </div>
  );
}

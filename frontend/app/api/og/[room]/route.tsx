import { ImageResponse } from "next/og";
import { roomByPath } from "@/lib/rooms";
import { decodeTiers, roomArt, type Tier } from "@/lib/share";
import { CATEGORY_HEX } from "@/lib/types";

// PARLOR v3 §3.0 — parameterized share-card endpoint. Games never edit this
// file: they pass a finished run through lib/share.ts (ogImageUrl) and link to
// it. The card reads ?g=<tier-codes>&d=<date>&s=<score>&m=<max> and draws the
// run as coloured squares — no DB read, no emoji font dependency. §3.14 extends
// this with per-room art; the shared frame stays here.
//
// Built on Next's bundled `next/og` (the @vercel/og engine) — no extra dep.
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

// Tier → square colour (parlor palette; mirrors lib/share.ts square meaning).
const TIER_HEX: Record<Tier, string> = {
  hit: "#2d9155",
  near: "#c9a24a",
  miss: "#3a1822",
  blank: "#5a4452",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const { room } = await params;
  const url = new URL(req.url);
  const meta = roomByPath(`/${room}`);
  const accent = meta ? CATEGORY_HEX[meta.accent] : "#c9a24a";
  const name = meta?.name ?? "PARLOR";
  const art = roomArt(room); // §3.14 — per-room persona + suit emblem

  const tiers = decodeTiers(url.searchParams.get("g") ?? "");
  const date = url.searchParams.get("d") ?? "";
  const score = url.searchParams.get("s");
  const max = url.searchParams.get("m");
  const scoreLine =
    score != null ? `${score}${max != null ? ` / ${max}` : ""}${date ? ` · ${date}` : ""}` : date;

  // Wrap the squares so a long run stays on the card (10 per row).
  const PER_ROW = 10;
  const rows: Tier[][] = [];
  for (let i = 0; i < tiers.length; i += PER_ROW) rows.push(tiers.slice(i, i + PER_ROW));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#150409",
          color: "#f0e6cf",
          padding: "72px",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* §3.14 — per-room emblem: a giant faint suit bleeds off the corner,
            tinted with the room accent, so each card reads as its own room. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -120,
            right: -40,
            fontSize: 480,
            lineHeight: 1,
            color: accent,
            opacity: 0.12,
          }}
        >
          {art.suit}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: accent, textTransform: "uppercase" }}>
            {art.persona}
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
            {name}
          </div>
          {scoreLine ? (
            <div style={{ fontSize: 34, color: "#9a7a78" }}>{scoreLine}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {rows.map((rowTiers, r) => (
            <div key={r} style={{ display: "flex", gap: "12px" }}>
              {rowTiers.map((t, c) => (
                <div
                  key={c}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    background: TIER_HEX[t],
                    border: "2px solid rgba(201,162,74,0.35)",
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 30, color: accent, letterSpacing: 4 }}>parlor.an9.dev</div>
          <div style={{ display: "flex", fontSize: 30, color: accent, letterSpacing: 6 }}>
            {art.suit}
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}

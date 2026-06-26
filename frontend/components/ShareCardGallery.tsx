"use client";

// PARLOR v3 §3.14 — the in-app result-card gallery.
//
// A drop-in finish-screen surface for any game: it takes the run's `GameResult`,
// renders the live OG share-card (the exact image a link will preview) above the
// emoji grid, and wires the canonical share / copy actions. Games hand it a
// result and nothing else — the card art, URL and grid all come from the
// lib/share.ts seam, so there is one source for what a share looks like.
//
// Pure client UI: no DB, no accounts (the v3 invariant). The OG image is a
// remote, per-run URL, so it stays a plain <img> (next/image can't optimise an
// arbitrary query string and would need a domain allow-list it doesn't need).
import { useState } from "react";
import { buildShare, roomArt, type GameResult } from "@/lib/share";
import { roomByPath } from "@/lib/rooms";
import { CATEGORY_HEX } from "@/lib/types";

export default function ShareCardGallery({
  result,
  className = "",
}: {
  result: GameResult;
  className?: string;
}) {
  const [msg, setMsg] = useState("");
  const card = buildShare(result);
  const meta = roomByPath(result.room);
  const accent = meta ? CATEGORY_HEX[meta.accent] : "#c9a24a";
  const art = roomArt(result.room);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2000);
  }

  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: card.title, text: card.text, url: card.url });
        return;
      }
      await navigator.clipboard.writeText(card.text);
      flash("copied!");
    } catch {
      /* dismissed the share sheet, or clipboard blocked — no-op */
    }
  }

  async function copyGrid() {
    try {
      await navigator.clipboard.writeText(card.text);
      flash("copied!");
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className={`mx-auto w-full max-w-md ${className}`}>
      <p className="microlabel mb-2" style={{ color: accent }}>
        {art.suit} {art.persona}
      </p>

      {/* The live share card — exactly what a pasted link previews. */}
      <div
        className="overflow-hidden rounded-2xl border bg-bg/60"
        style={{ borderColor: `${accent}66` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.ogImage}
          alt={`${card.title} share card`}
          width={1200}
          height={630}
          className="block h-auto w-full"
        />
      </div>

      {/* The text artifact (emoji grid) for chat apps that strip images. */}
      <pre className="mt-3 whitespace-pre text-center text-sm leading-tight tracking-widest">
        {card.grid}
      </pre>

      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button
          onClick={share}
          className="microlabel rounded-full border px-6 py-3 transition hover:text-bg"
          style={{ borderColor: accent, color: accent }}
        >
          {msg || "share result"}
        </button>
        <button
          onClick={copyGrid}
          className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
        >
          copy grid
        </button>
        <a
          href={card.url}
          className="microlabel rounded-full border border-line px-6 py-3 text-muted transition hover:border-ink hover:text-ink"
        >
          open room
        </a>
      </div>
    </div>
  );
}

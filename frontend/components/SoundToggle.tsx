"use client";

import { useEffect, useState } from "react";
import { isMuted, toggleMuted } from "@/lib/sound";

/** Persistent mute control. Reads the shared sound-engine flag on mount. */
export default function SoundToggle() {
  const [muted, setMuted] = useState(true); // assume muted until mounted (SSR-safe)

  useEffect(() => {
    setMuted(isMuted());
  }, []);

  return (
    <button
      onClick={() => setMuted(toggleMuted())}
      className="microlabel rounded-full border border-line bg-surface/70 px-3 py-1.5 backdrop-blur transition hover:border-ink"
      aria-label={muted ? "unmute sound" : "mute sound"}
      title={muted ? "sound off" : "sound on"}
    >
      {muted ? "🔇 sound off" : "🔊 sound on"}
    </button>
  );
}

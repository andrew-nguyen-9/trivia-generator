import RoomShell from "@/components/RoomShell";
import { roomMetadata } from "@/lib/rooms";
import styles from "./coming-soon.module.css";

// §3.0 placeholder — route + registry reserved here so §3.22 (the audio room,
// "Name the Intro") adds only its own files. §3.22 replaces this page with
// app/overture/page.tsx + AudioRoomGame.tsx + AudioRoom.module.css.
export const metadata = roomMetadata("/overture");

export default function OverturePage() {
  return (
    <RoomShell label="The Overture" accent="music">
      <div className={styles.panel}>
        <span className={styles.glyph} aria-hidden>
          ♫
        </span>
        <h1 className="display text-2xl tracking-[0.04em]">The Overture</h1>
        <p className="max-w-sm text-sm text-muted">
          Name the intro from the parlor&rsquo;s record collection. This room is
          being tuned — it opens soon.
        </p>
      </div>
    </RoomShell>
  );
}

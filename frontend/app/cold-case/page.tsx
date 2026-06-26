import RoomShell from "@/components/RoomShell";
import { roomMetadata } from "@/lib/rooms";
import styles from "./coming-soon.module.css";

// §3.0 placeholder — route + registry reserved here so §3.23 (the hard-mode
// weekly Mystery) adds only its own files. §3.23 replaces this page with
// app/cold-case/page.tsx + WeeklyCaseGame.tsx + WeeklyCase.module.css.
export const metadata = roomMetadata("/cold-case");

export default function ColdCasePage() {
  return (
    <RoomShell label="The Cold Case" accent="history">
      <div className={styles.panel}>
        <span className={styles.glyph} aria-hidden>
          ⚱
        </span>
        <h1 className="display text-2xl tracking-[0.04em]">The Cold Case</h1>
        <p className="max-w-sm text-sm text-muted">
          A week-long mystery with clues drawn from every room of the Order. The
          file is being assembled — it opens soon.
        </p>
      </div>
    </RoomShell>
  );
}

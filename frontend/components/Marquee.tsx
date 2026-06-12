/** Infinite fact ticker (apechain energy). Content duplicated for the seamless
 *  -50% translate loop; pauses on hover. */
export default function Marquee({ items }: { items: string[] }) {
  const row = items.join("  ✦  ");
  return (
    <div className="overflow-hidden border-y border-line py-3 [&:hover_div]:[animation-play-state:paused]">
      <div className="animate-marquee flex w-max whitespace-nowrap">
        <span className="microlabel pr-8">{row}  ✦  </span>
        <span className="microlabel pr-8" aria-hidden>
          {row}  ✦
        </span>
      </div>
    </div>
  );
}

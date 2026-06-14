"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sfx } from "@/lib/sound";
import type { Achievement } from "@/lib/profile";

/** Drops a stack of "achievement unlocked" toasts whenever `queue` changes. */
export default function AchievementToast({ queue }: { queue: Achievement[] }) {
  const [shown, setShown] = useState<Achievement[]>([]);

  useEffect(() => {
    if (queue.length === 0) return;
    setShown(queue);
    sfx.win();
    const t = setTimeout(() => setShown([]), 4200);
    return () => clearTimeout(t);
  }, [queue]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
      <AnimatePresence>
        {shown.map((a) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className="flex items-center gap-3 rounded-xl border border-wildcard bg-surface/95 px-4 py-3 shadow-lg backdrop-blur"
            style={{ boxShadow: "0 0 32px #b07aff44" }}
          >
            <span className="text-2xl">{a.icon}</span>
            <div>
              <p className="microlabel text-wildcard">achievement unlocked</p>
              <p className="text-sm font-black">{a.name}</p>
              <p className="text-xs text-muted">{a.desc}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

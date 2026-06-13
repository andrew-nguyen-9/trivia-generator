"use client";

import { motion, useReducedMotion } from "framer-motion";

/** App Router template re-mounts on every navigation — so this gives each room
 *  a soft enter (rise + fade), the "stepping through a door" feel. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

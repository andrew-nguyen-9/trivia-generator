"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_HEX, type Category } from "@/lib/types";

export default function RoomCard({
  index,
  href,
  name,
  blurb,
  accent,
}: {
  index: number;
  href: string;
  name: string;
  blurb: string;
  accent: Category;
}) {
  const reduced = useReducedMotion();
  const hex = CATEGORY_HEX[accent];
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      whileHover={reduced ? {} : { rotate: index % 2 ? 1.6 : -1.6, scale: 1.015 }}
    >
      <Link
        href={href}
        className="group block rounded-2xl border border-line bg-surface p-6 transition sm:p-8"
        style={{ boxShadow: `0 0 0px ${hex}00` }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 48px ${hex}33, inset 0 0 0 1px ${hex}`)}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 0px ${hex}00`)}
      >
        <div className="flex items-baseline justify-between">
          <span className="microlabel">room {String(index + 1).padStart(2, "0")}</span>
          <span className="microlabel transition group-hover:translate-x-1" style={{ color: hex }}>
            enter →
          </span>
        </div>
        <h2 className="display mt-4 text-5xl sm:text-6xl" style={{ color: hex }}>
          {name}
        </h2>
        <p className="mt-3 max-w-md text-sm text-muted">{blurb}</p>
      </Link>
    </motion.div>
  );
}

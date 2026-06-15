"use client";

// Velvet curtain: each route change fades the new page in with a slight upward
// drift — the sensation of stepping through a heavy doorway into the next room.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

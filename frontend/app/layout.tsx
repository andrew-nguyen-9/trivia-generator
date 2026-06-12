import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PARLOR — an after-dark house of trivia games",
  description:
    "Four trivia rooms — The Board, The Clock, The Wedges, The Streak — forged nightly from Wikipedia, Deezer, Sleeper/ESPN and TMDB.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise min-h-screen">{children}</body>
    </html>
  );
}

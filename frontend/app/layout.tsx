import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";

// Art-deco display face: Roman inscriptions / engraved-signage feel.
// Loaded via next/font for zero layout shift and self-hosted serving.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PARLOR — an after-dark house of trivia games",
  description:
    "Eleven trivia rooms — forged nightly from Wikipedia, Deezer, Sleeper/ESPN and TMDB. Pick a door.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body className="noise min-h-screen">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import GoldSheen from "@/components/GoldSheen";
import SiteFooter from "@/components/SiteFooter";
import ThemeToggle from "@/components/ThemeToggle";
import { GAME_ROOMS, SITE_URL } from "@/lib/rooms";
import "./globals.css";

// Art-deco display face: Roman inscriptions / engraved-signage feel.
// Loaded via next/font for zero layout shift and self-hosted serving.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const SITE_NAME = "PARLOR";
const TAGLINE = "a secret order of the curious";
const DEFAULT_TITLE = `${SITE_NAME} — ${TAGLINE}`;
const DEFAULT_DESC =
  "Ten rooms behind one velvet door — trivia forged nightly and a new murder mystery every dusk. Light a candle and pick a door.";
// Square seal works as a "summary" card; explicit dims keep crawlers from guessing.
const SEAL = { url: "/logo-512.png", width: 512, height: 512, alt: "The Secret Order seal" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Per-route pages set `title` to a bare phrase; the template appends the brand.
  title: { default: DEFAULT_TITLE, template: "%s · PARLOR" },
  description: DEFAULT_DESC,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  keywords: [
    "trivia",
    "daily trivia",
    "murder mystery game",
    "quiz games",
    "PARLOR",
    "guessing games",
  ],
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: DEFAULT_TITLE,
    description: "Ten rooms. A nightly question bank and a daily mystery.",
    images: [SEAL],
  },
  twitter: {
    card: "summary",
    title: DEFAULT_TITLE,
    description: "Ten rooms. A nightly question bank and a daily mystery.",
    images: [SEAL.url],
  },
};

// Site-wide structured data: the WebSite itself + the deck of games as an
// ItemList (covers PLATFORM §2.13 "WebSite, and per-game where it fits").
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: DEFAULT_DESC,
    },
    {
      "@type": "ItemList",
      name: "The PARLOR deck",
      itemListElement: GAME_ROOMS.map((room, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${room.path}`,
        name: room.name,
      })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable} suppressHydrationWarning>
      <head>
        {/* No-flash theme resolution: runs before paint. stored → system → dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('parlor.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}`,
          }}
        />
      </head>
      <body className="noise min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <GoldSheen />
        {children}
        <SiteFooter />
        <ThemeToggle />
      </body>
    </html>
  );
}

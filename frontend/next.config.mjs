import { fileURLToPath } from "node:url";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the trace root to this app. A stray parent-dir lockfile otherwise makes
  // Next infer the monorepo root and the build-trace step fails (ENOENT .nft.json).
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "**.dzcdn.net" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);

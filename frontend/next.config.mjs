import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "**.dzcdn.net" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "a.espncdn.com" },
    ],
  },
};

export default nextConfig;

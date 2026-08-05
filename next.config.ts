import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel has its own optimized build/deploy pipeline and this option
  // breaks it (ENOENT on next-server.js.nft.json). Only enable the
  // standalone build for self-hosted Docker builds, which run outside
  // Vercel's build environment (no VERCEL env var set there).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;

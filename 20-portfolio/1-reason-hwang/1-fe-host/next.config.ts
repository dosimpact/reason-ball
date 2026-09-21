import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An owned validation server can build without replacing the user's live build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  // An owned validation server can build without replacing the user's live build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  async redirects() { return [{ source: "/chat", destination: "/langgraph-dev-chat", permanent: false }]; },
};

export default nextConfig;

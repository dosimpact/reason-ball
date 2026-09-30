import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production verification independent from the running development server.
  distDir: process.env.PLAYWRIGHT_LIVE_PRODUCTION === "1" ? ".next-live" : process.env.PLAYWRIGHT_MOCK_SERVER === "1" ? ".next-mock" : ".next",
  // Allow the LAN development URL to load Next.js dev assets and hydrate.
  allowedDevOrigins: ["192.168.0.45", "dodonet.iptime.org"],
};

export default nextConfig;

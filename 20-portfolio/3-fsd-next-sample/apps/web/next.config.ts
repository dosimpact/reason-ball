import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the LAN development URL to load Next.js dev assets and hydrate.
  allowedDevOrigins: ["192.168.0.45", "dodonet.iptime.org"],
};

export default nextConfig;

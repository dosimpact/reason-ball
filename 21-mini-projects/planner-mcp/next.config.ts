import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: (process.env.PLANNER_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => !!host && !host.includes("*")),
};

export default config;

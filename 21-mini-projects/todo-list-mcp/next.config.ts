import type { NextConfig } from "next";
import { resolve } from "node:path";
const config: NextConfig = {
  allowedDevOrigins: (process.env.TODO_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().split(":")[0])
    .filter(Boolean),
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  turbopack: { root: resolve(process.cwd(), "../..") },
};
export default config;

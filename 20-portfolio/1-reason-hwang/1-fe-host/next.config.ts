import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "..");
// react-lang auto-mounts a CDN-backed Inspect/deployment widget in development.
// Keep diagnostics an explicit app choice; never alter generated answer text.
const openuiDevtoolsEnabled = process.env.OPENUI_DEVTOOLS === "true";
const disabledDevtools = path.resolve(__dirname, "src/shared/config/openui-devtools-disabled.ts");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot, resolveAlias: openuiDevtoolsEnabled ? {} : { "@openuidev/devtools": "./src/shared/config/openui-devtools-disabled.ts" } },
  webpack(config) {
    if (!openuiDevtoolsEnabled) {
      config.resolve ??= {};
      config.resolve.alias = { ...config.resolve.alias, "@openuidev/devtools$": disabledDevtools };
    }
    return config;
  },
  // An owned validation server can build without replacing the user's live build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  async redirects() { return [{ source: "/chat", destination: "/langgraph-dev-chat", permanent: false }]; },
};

export default nextConfig;

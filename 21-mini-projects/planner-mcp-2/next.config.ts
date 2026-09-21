import path from "node:path";
import type { NextConfig } from "next";
import { editorModuleAliases } from "./config/editor-modules";
const config: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@/modules/codeweave/core": "./.codeweave-build/index.js",
      ...Object.fromEntries(
        Object.entries(editorModuleAliases).map(([name, target]) => [
          name,
          "./" + path.relative(process.cwd(), target),
        ]),
      ),
    },
  },
  allowedDevOrigins: (process.env.PLANNER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).hostname),
};
export default config;

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "mobile" ? [viteSingleFile()] : [])],
  base: "./",
  server: {
    watch: {
      ignored: [
        "**/mobile/**",
        "**/dist-mobile/**",
        "**/playwright-report/**",
        "**/test-results/**",
        "**/docs/**",
      ],
    },
  },
  build: { outDir: mode === "mobile" ? "dist-mobile" : "dist" },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
}));

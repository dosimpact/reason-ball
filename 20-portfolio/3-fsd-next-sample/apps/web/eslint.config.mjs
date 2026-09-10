import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const restrictHigherLayers = (layers, message) => [
  "error",
  {
    patterns: layers.flatMap((layer) => [
      {
        group: [`@/${layer}`, `@/${layer}/**`],
        message,
      },
    ]),
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "playwright-security-report/**",
    "test-results/**",
    "test-results-security/**",
    "test-results-contracts/**",
  ]),
  {
    files: ["src/widgets/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictHigherLayers(
        ["app"],
        "FSD widgets may depend only on features, entities, and shared.",
      ),
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictHigherLayers(
        ["app", "widgets"],
        "FSD features may depend only on entities and shared.",
      ),
    },
  },
  {
    files: ["src/entities/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictHigherLayers(
        ["app", "widgets", "features"],
        "FSD entities may depend only on shared.",
      ),
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictHigherLayers(
        ["app", "widgets", "features", "entities"],
        "FSD shared cannot depend on higher layers.",
      ),
    },
  },
]);

export default eslintConfig;

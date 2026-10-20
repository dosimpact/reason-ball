/*
 * Next.js·TypeScript 정적 검사 규칙입니다. 생성물과 실행 결과를 검사 대상에서 제외합니다.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Preserve copied upstream renderers; OpenUI invokes `component` as React components.
  { files: ["src/lib/components/controls.tsx"], rules: { "react-hooks/rules-of-hooks": "off" } },
  // Upstream chart accumulates an angle locally during render; preview reads its browser bridge after mount.
  { files: ["src/lib/components/chart.tsx"], rules: { "react-hooks/immutability": "off" } },
  { files: ["src/app/preview/preview.tsx"], rules: { "react-hooks/set-state-in-effect": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([".venv/**", "output/**", ".playwright-cli/**", "playwright-report/**", "test-results/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

import type { NextConfig } from "next";
import path from "node:path";
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/api/documents": ["./database/**/*"] },
  turbopack: { root: path.resolve(process.cwd()) },
  devIndicators: false,
};
export default nextConfig;

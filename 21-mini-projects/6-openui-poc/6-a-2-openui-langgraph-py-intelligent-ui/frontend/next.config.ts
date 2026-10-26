/*
 * 이 프런트엔드 폴더를 빌드 기준으로 삼는 Next.js 설정입니다. 독립 배포 출력과 Turbopack 옵션을 관리합니다.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  experimental: {
    turbopackMinify: false,
  },
};

export default nextConfig;

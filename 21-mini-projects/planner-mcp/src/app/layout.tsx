import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Planner MCP · Design Workspace",
  description:
    "요구사항부터 개발 인계까지, 프로젝트 설계를 한곳에서 관리합니다.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

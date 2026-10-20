/*
 * 전체 페이지가 공유하는 루트 레이아웃입니다. 글꼴·전역 스타일·페이지 메타데이터를 설정합니다.
 */
import { WorkspaceTheme } from "@/canvas/theme";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Lite Canvas · 공급업체 리포트",
  description: "Generative UI chat streamed from a multi-agent LangGraph graph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}><WorkspaceTheme>{children}</WorkspaceTheme></body>
    </html>
  );
}

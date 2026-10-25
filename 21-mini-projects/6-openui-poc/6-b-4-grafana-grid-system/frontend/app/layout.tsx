/*
 * 전체 페이지가 공유하는 루트 레이아웃입니다. 글꼴·전역 스타일·페이지 메타데이터를 설정합니다.
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Filing Studio · SEC Research",
  description: "Page-cited document comparisons with Python LangGraph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

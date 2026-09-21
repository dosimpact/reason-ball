import type { Metadata } from "next";
import "./globals.css";
import { Workspace } from "@/widgets/workspace/workspace";
export const metadata: Metadata = {
  title: "Planner — 설계와 검증",
  description: "설계 문서와 AI 구현, 사람 검증을 연결하는 작업 공간",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Workspace guide={children} />
      </body>
    </html>
  );
}

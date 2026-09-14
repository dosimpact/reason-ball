import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Todo Together · MCP",
  description: "A shared local todo workspace for you and AI",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

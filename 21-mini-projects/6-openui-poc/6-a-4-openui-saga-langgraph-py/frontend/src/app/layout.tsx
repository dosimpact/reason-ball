import type { Metadata } from "next";
import "./globals.css";
import { SagaThemeProvider } from "@/components/saga/theme";

export const metadata: Metadata = {
  title: "Saga · Generative workspace",
  description: "Generative UI with Grafana Saga and Python LangGraph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><SagaThemeProvider>{children}</SagaThemeProvider></body>
    </html>
  );
}

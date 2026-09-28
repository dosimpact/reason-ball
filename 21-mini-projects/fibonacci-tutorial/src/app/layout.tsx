import type { Metadata } from "next";
import { QueryProvider } from "./providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "파동을 읽는 연습 | Fibonacci Lab",
  description: "가격을 읽고, 계획을 세우고, 다음 캔들에서 판단을 검증하는 파동 학습 공간",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" data-color-mode="light" data-light-theme="light" data-dark-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try { document.documentElement.dataset.colorMode = localStorage.getItem("fibonacci-lab:theme") === "dark" ? "dark" : "light"; } catch {}` }} /></head><body><QueryProvider>{children}</QueryProvider></body></html>;
}

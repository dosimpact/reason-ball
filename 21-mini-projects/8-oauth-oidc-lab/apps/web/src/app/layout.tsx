import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OAuth & OIDC Protocol Lab",
  description: "Observe Authorization Code, PKCE, OIDC, JWT, and API authorization as real HTTP exchanges.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

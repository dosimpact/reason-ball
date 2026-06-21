import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Reason Hwang Host",
  description: "Next.js module federation host for Reason Hwang remotes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="flex min-h-dvh bg-background">
          <AppSidebar />
          <main className="min-w-0 flex-1">
            <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 md:px-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

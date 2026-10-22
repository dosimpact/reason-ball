import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AppSidebar } from "@/widgets/host-navigation";
import { Separator } from "@/shared/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { cn } from "@/shared/lib/utils";

import { HostThemeProvider } from "@/shared/lib/theme";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { themeInitScript } from "../config/theme-init";

import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Reason Hwang Host",
  description: "Next.js module federation host for Reason Hwang remotes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en" className={cn("font-sans", inter.variable)}>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="font-sans" suppressHydrationWarning>
        <HostThemeProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Reason Hwang FE Host
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Module federation host shell
                </p>
              </div>
              <ThemeToggle />
            </header>
            <div className="min-h-[calc(100svh-3.5rem)] w-full">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
        </HostThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AppSidebar, MobileSidebarTrigger } from "@/widgets/host-navigation";
import {
  SidebarInset,
  SidebarProvider,
} from "@/shared/ui/sidebar";
import { cn } from "@/shared/lib/utils";

import { HostThemeProvider } from "@/shared/lib/theme";
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
          <MobileSidebarTrigger />
          <SidebarInset className="min-w-0">
            <div className="min-h-svh w-full">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
        </HostThemeProvider>
      </body>
    </html>
  );
}

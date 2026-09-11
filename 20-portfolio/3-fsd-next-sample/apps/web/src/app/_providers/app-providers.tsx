"use client";

import type { ReactNode } from "react";
import { UiMessagesProvider } from "@/shared/i18n/ui-messages-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider><UiMessagesProvider>{children}</UiMessagesProvider></QueryProvider>
    </ThemeProvider>
  );
}

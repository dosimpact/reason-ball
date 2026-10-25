"use client";

import { OpenUIDevtools } from "@openuidev/devtools";

export function DevelopmentTools() {
  if (process.env.NODE_ENV !== "development") return null;

  return <OpenUIDevtools position="bottom-right" version="0.3.0" />;
}

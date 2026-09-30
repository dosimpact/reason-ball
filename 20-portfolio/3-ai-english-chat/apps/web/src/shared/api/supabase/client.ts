"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "./config";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) {
    return client;
  }

  const { publishableKey, url } = getPublicSupabaseConfig();

  client = createBrowserClient(url, publishableKey);

  return client;
}

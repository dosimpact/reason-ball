import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing configuration: ${missing.join(", ")}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let failed = false;
function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed = true;
}

try {
  const settings = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(10_000),
  });
  report("Public API key", settings.ok, `HTTP ${settings.status}`);
  if (settings.ok) {
    const body = await settings.json();
    report("Anonymous sign-in enabled", body.external?.anonymous_users === true);
  }

  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  };
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, options);
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  report("Server API key", !authError && Array.isArray(authData?.users), authError ? `HTTP ${authError.status ?? "unknown"}` : "");
  for (const table of ["profiles", "characters", "missions", "learner_preferences", "learning_notebook_entries"]) {
    // GET checks schema resolution; a successful HEAD alone is insufficient.
    const { data, error } = await admin.from(table).select(table === "learner_preferences" ? "user_id" : "id").limit(1);
    report(`Schema ${table}`, !error && Array.isArray(data), error ? `code ${error.code}` : "");
  }
} catch {
  report("Network connection", false, "Request failed or timed out; check the project URL and network.");
}

process.exitCode = failed ? 1 : 0;

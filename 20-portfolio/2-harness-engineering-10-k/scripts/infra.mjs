import process from "node:process";
import { spawnSync } from "node:child_process";

const action = process.argv[2];

const script =
  action === "up"
    ? "infra:up"
    : action === "down"
      ? "infra:down"
      : null;

if (!script) {
  console.error("Usage: pnpm run infra <up|down>");
  process.exit(1);
}

const result = spawnSync("pnpm", ["run", script], {
  stdio: "inherit",
  env: process.env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);

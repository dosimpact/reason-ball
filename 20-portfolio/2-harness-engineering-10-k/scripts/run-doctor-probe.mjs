import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const collectorRoot = fileURLToPath(
  new URL("../2-10-k-collector/", import.meta.url),
);
const parserRoot = fileURLToPath(new URL("../3-10-k-parser/", import.meta.url));
const chatbotRoot = fileURLToPath(
  new URL("../4-10-k-chat-bot-next/", import.meta.url),
);
const nextEnvFile = fileURLToPath(
  new URL("../4-10-k-chat-bot-next/next-env.d.ts", import.meta.url),
);

const parserStartCommand =
  'UV_BIN=$(sh ../scripts/ensure-uv.sh) && "$UV_BIN" sync --project . && exec "$UV_BIN" run --project . python -m parser.server --host "${APP_HOST:-0.0.0.0}" --port "${APP_PORT:-3406}"';
const servicePorts = [3003, 3305, 3406];
const services = [];
let nextEnvSnapshotDir = null;
let hadNextEnv = false;

const sharedEnv = {
  POSTGRES_URL:
    process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@127.0.0.1:55432/chat_bot",
  PARSER_BACKEND_URL:
    process.env.PARSER_BACKEND_URL || "http://127.0.0.1:3406",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:55432/sec_collector",
  COLLECTOR_DATABASE_URL:
    process.env.COLLECTOR_DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:55432/sec_collector",
  COLLECTOR_DATA_DIR:
    process.env.COLLECTOR_DATA_DIR ||
    join(workspaceRoot, "2-10-k-collector"),
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
};

function snapshotNextEnv() {
  if (nextEnvSnapshotDir !== null) {
    return;
  }

  nextEnvSnapshotDir = mkdtempSync(join(tmpdir(), "10k-doctor-next-env-"));
  hadNextEnv = existsSync(nextEnvFile);

  if (hadNextEnv) {
    copyFileSync(nextEnvFile, join(nextEnvSnapshotDir, "next-env.d.ts"));
  }
}

function restoreNextEnv() {
  if (nextEnvSnapshotDir === null) {
    return;
  }

  const snapshotFile = join(nextEnvSnapshotDir, "next-env.d.ts");
  if (hadNextEnv && existsSync(snapshotFile)) {
    copyFileSync(snapshotFile, nextEnvFile);
  } else if (!hadNextEnv && existsSync(nextEnvFile)) {
    unlinkSync(nextEnvFile);
  }

  rmSync(nextEnvSnapshotDir, { recursive: true, force: true });
  nextEnvSnapshotDir = null;
  hadNextEnv = false;
}

function run(command, args, options = {}) {
  const { env, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ...env,
      },
      ...spawnOptions,
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? "null"} signal ${signal ?? "none"}`,
        ),
      );
    });
  });
}

function spawnService(name, command, args, options = {}) {
  const { env, ...spawnOptions } = options;
  const child = spawn(command, args, {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...sharedEnv,
      ...env,
    },
    ...spawnOptions,
  });

  services.push({ name, child });
  return child;
}

async function killListeningPort(port) {
  await run("sh", [
    "-lc",
    `pids=$(lsof -tiTCP:${port} -sTCP:LISTEN -n -P 2>/dev/null || true); if [ -n "$pids" ]; then kill $pids >/dev/null 2>&1 || true; sleep 1; fi`,
  ]).catch(() => {});
}

async function waitForHttp(url, timeoutMs = 180_000) {
  const startedAt = Date.now();
  let lastError = "unknown";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }

      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function cleanup() {
  for (const { child } of services.toReversed()) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  await sleep(2_000);

  for (const { child } of services.toReversed()) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
  }

  for (const port of servicePorts) {
    await killListeningPort(port);
  }

  restoreNextEnv();

  await run("pnpm", ["run", "infra:down"]).catch(() => {});
}

async function main() {
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(130);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(143);
  });

  try {
    await run("pnpm", ["run", "infra:up"]);
    await run("pnpm", ["--filter", "@10k/chatbot", "run", "db:migrate"], {
      env: sharedEnv,
    });

    for (const port of servicePorts) {
      await killListeningPort(port);
    }

    snapshotNextEnv();

    spawnService("collector", "./node_modules/.bin/tsx", ["src/main.ts"], {
      cwd: collectorRoot,
    });
    spawnService("parser", "sh", ["-lc", parserStartCommand], {
      cwd: parserRoot,
    });
    spawnService(
      "chatbot",
      "./node_modules/.bin/next",
      ["dev", "--webpack", "--port", process.env.PORT || "3003"],
      {
        cwd: chatbotRoot,
      },
    );

    await Promise.all([
      waitForHttp("http://127.0.0.1:3305/api/filings/status-summary"),
      waitForHttp("http://127.0.0.1:3406/health"),
      waitForHttp("http://127.0.0.1:3003/api/copilotkit/info"),
    ]);

    await run("pnpm", ["run", "doctor:probe"], {
      env: {
        ...sharedEnv,
        DOCTOR_PROBE_ATTEMPTS: process.env.DOCTOR_PROBE_ATTEMPTS || "30",
        DOCTOR_PROBE_DELAY_MS: process.env.DOCTOR_PROBE_DELAY_MS || "1000",
      },
    });
  } finally {
    await cleanup();
  }
}

await main();

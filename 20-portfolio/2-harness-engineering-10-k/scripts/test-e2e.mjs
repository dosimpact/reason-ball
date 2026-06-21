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
import { setTimeout as sleep } from "node:timers/promises";
import process from "node:process";
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
const parserDevCommand =
  'UV_BIN=$(sh ../scripts/ensure-uv.sh) && "$UV_BIN" sync --project . && exec "$UV_BIN" run --project . python -m parser.server --host "${APP_HOST:-0.0.0.0}" --port "${APP_PORT:-3406}" --reload';
const services = [];
let nextEnvSnapshotDir = null;
let hadNextEnv = false;

function snapshotNextEnv() {
  if (nextEnvSnapshotDir !== null) {
    return;
  }

  nextEnvSnapshotDir = mkdtempSync(join(tmpdir(), "10k-e2e-next-env-"));
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

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: false,
      env: process.env,
      ...options,
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${cmd} ${args.join(" ")} exited with code ${code ?? "null"} signal ${signal ?? "none"}`,
        ),
      );
    });
  });
}

function createNextDevAbortNoiseFilter() {
  let pendingAbortBlock = null;

  const flushPendingAbortBlock = () => {
    if (pendingAbortBlock === null) {
      return "";
    }

    const block = pendingAbortBlock.join("\n");
    pendingAbortBlock = null;

    return /code:\s*'ECONNRESET'/.test(block) ? "" : `${block}\n`;
  };

  const filter = (line) => {
    if (
      pendingAbortBlock === null &&
      /(?:^|\s)Error: aborted\b/.test(line)
    ) {
      pendingAbortBlock = [line];
      return "";
    }

    if (pendingAbortBlock !== null) {
      pendingAbortBlock.push(line);

      if (line.trim() === "}" || pendingAbortBlock.length >= 6) {
        return flushPendingAbortBlock();
      }

      return "";
    }

    return `${line}\n`;
  };

  filter.flush = flushPendingAbortBlock;
  return filter;
}

function pipeFilteredLines(stream, destination, createLineFilter) {
  const filterLine = createLineFilter();
  let buffer = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const output = filterLine(line);
      if (output) {
        destination.write(output);
      }
    }
  });

  stream.on("end", () => {
    if (!buffer) {
      return;
    }

    const output = filterLine(buffer);
    if (output) {
      destination.write(output);
    }
  });

  stream.on("close", () => {
    const output = filterLine.flush?.();
    if (output) {
      destination.write(output);
    }
  });
}

function spawnService(name, cmd, args, env = {}, options = {}) {
  const { outputFilter, ...spawnOptions } = options;
  const child = spawn(cmd, args, {
    cwd: workspaceRoot,
    stdio: outputFilter ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
    env: {
      ...process.env,
      ...env,
    },
    ...spawnOptions,
  });

  if (outputFilter) {
    pipeFilteredLines(child.stdout, process.stdout, outputFilter);
    pipeFilteredLines(child.stderr, process.stderr, outputFilter);
  }

  services.push({ name, child });
  return child;
}

function omitNoColor(env) {
  const nextEnv = { ...env };
  delete nextEnv.NO_COLOR;
  return nextEnv;
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
  for (const { child } of services) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  await sleep(2_000);

  for (const { child } of services) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
  }

  await run("sh", [
    "-lc",
    "pkill -f 'Chromium|chrome.*remote-debugging-pipe|playwright|playwright-core|headless_shell' >/dev/null 2>&1 || true",
  ]).catch(() => {});

  restoreNextEnv();

  await run("pnpm", ["run", "infra:down"]).catch(() => {});
}

async function main() {
  const baseUrl = process.env.CHATBOT_BASE_URL || "http://127.0.0.1:3003/";
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
      "/Users/studio/.openclaw/workspace/harness-engineering-10-k/2-10-k-collector",
    INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS: "true",
  };

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
      env: {
        ...process.env,
        ...sharedEnv,
      },
    });
    await killListeningPort(3003);
    await killListeningPort(3305);
    await killListeningPort(3406);
    snapshotNextEnv();

    spawnService("collector", "./node_modules/.bin/tsx", ["src/main.ts"], sharedEnv, {
      cwd: collectorRoot,
    });
    spawnService(
      "parser",
      "sh",
      ["-lc", parserDevCommand],
      sharedEnv,
      { cwd: parserRoot },
    );
    spawnService(
      "chatbot",
      "./node_modules/.bin/next",
      ["dev", "--webpack", "--port", process.env.PORT || "3003"],
      sharedEnv,
      { cwd: chatbotRoot, outputFilter: createNextDevAbortNoiseFilter },
    );

    await Promise.all([
      waitForHttp("http://127.0.0.1:3305/api/filings?limit=1"),
      waitForHttp("http://127.0.0.1:3406/health"),
      waitForHttp(baseUrl),
    ]);

    await run(
      "pnpm",
      ["--filter", "@10k/chatbot", "run", "test:e2e"],
      {
        env: omitNoColor({
          ...process.env,
          ...sharedEnv,
          PORT: process.env.PORT || "3003",
          CHATBOT_BASE_URL: baseUrl,
          PLAYWRIGHT_SKIP_WEBSERVER: "true",
          PLAYWRIGHT: "true",
        }),
      },
    );
  } finally {
    await cleanup();
  }
}

await main();

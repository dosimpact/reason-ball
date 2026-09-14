import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
const port = 3137;
async function portFree() {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
if (!(await portFree()))
  throw new Error(
    "Test port 3137 is already occupied; existing server will not be reused or killed.",
  );
const directory = await mkdtemp(join(tmpdir(), "todo-e2e-"));
let child;
let terminating = false;
let stopTimeout;
function stop() {
  if (terminating) return;
  terminating = true;
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  stopTimeout = setTimeout(() => {
    if (child?.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    }
  }, 5000);
  stopTimeout.unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      detached: true,
      env: { ...process.env, TODO_DATA_FILE: join(directory, "todos.json") },
    },
  );
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  stop();
  // Only our Playwright process group may be terminated.
  for (let attempt = 0; attempt < 40 && !(await portFree()); attempt++)
    await delay(100);
  if (!(await portFree())) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
    await delay(200);
  }
  if (!(await portFree())) {
    process.exitCode = 1;
    console.error(
      "Test server cleanup failed; temporary data retained at",
      directory,
    );
  } else {
    await rm(directory, { recursive: true, force: true });
    console.log(
      "Cleanup verified: test port released; temporary JSON removed.",
    );
  }
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  clearTimeout(stopTimeout);
}

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

// Optional: uses the user's existing Codex login, but never changes Codex config.
const port = 3139;
const directory = await mkdtemp(join(tmpdir(), "todo-codex-"));
const children = [];
async function available() {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}
function launch(command, args, options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "inherit",
    ...options,
  });
  children.push(child);
  return child;
}
function stop() {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  if (!(await available())) throw new Error("Port 3139 is occupied");
  launch(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: { ...process.env, TODO_DATA_FILE: join(directory, "todos.json") },
    },
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch("http://127.0.0.1:" + port + "/api/todos")).ok;
    } catch {}
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw new Error("Next.js did not start");
  const child = launch(
    "codex",
    [
      "exec",
      "--ignore-user-config",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--json",
      "-C",
      directory,
      "-c",
      'mcp_servers.todo_test.url="http://127.0.0.1:3139/api/mcp"',
      "Use the todo_test MCP get_todo_list tool exactly once. Report the todo count. Do not use shell, filesystem, or other tools.",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  const timeout = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }, 60000);
  const hardTimeout = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }, 65000);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
  } finally {
    clearTimeout(timeout);
    clearTimeout(hardTimeout);
  }
  const events = output.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const called = events.some(
    (event) =>
      event.type === "item.completed" &&
      event.item?.type === "mcp_tool_call" &&
      event.item?.tool === "get_todo_list" &&
      event.item?.status === "completed",
  );
  if (code !== 0 || !called)
    throw new Error(
      "Codex MCP smoke did not complete a get_todo_list call; check login/model availability.",
    );
  console.log("Codex MCP smoke passed.");
} finally {
  stop();
  for (let attempt = 0; attempt < 40 && !(await available()); attempt++)
    await delay(100);
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }
  if (children.length && !(await available()))
    throw new Error(
      "Smoke server port still occupied; data retained at " + directory,
    );
  await rm(directory, { recursive: true, force: true });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  console.log("Codex smoke processes stopped and temporary data removed.");
}

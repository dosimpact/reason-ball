import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";

async function run(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: "inherit", env });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${command} exited ${code}`);
}
const probe = net.createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const data = await mkdtemp(path.join(tmpdir(), "planner-e2e-"));
const baseURL = `http://127.0.0.1:${port}`;
let server;
try {
  await run("pnpm", ["build"]);
  const env = {
    ...process.env,
    PLANNER_DATA_DIR: data,
    PLANNER_TEST_DATA: data,
    BASE_URL: baseURL,
    FIGMA_ACCESS_TOKEN: "planner-e2e-fake-token",
  };
  server = spawn(
    process.execPath,
    [
      "--require",
      path.resolve("scripts/e2e-figma.cjs"),
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { stdio: "inherit", env },
  );
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      ready = (await fetch(baseURL)).ok;
    } catch {
      /* server still starting */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error("Owned test server did not become ready");
  await run("pnpm", ["exec", "playwright", "test"], env);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
  await rm(data, { recursive: true, force: true });
}

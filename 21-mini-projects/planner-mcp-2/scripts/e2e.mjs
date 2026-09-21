import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
let server;
let active;
async function run(cmd, args, env = process.env, cwd = process.cwd()) {
  active = spawn(cmd, args, { stdio: "inherit", env, cwd });
  const [code] = await once(active, "exit");
  active = undefined;
  if (code !== 0) throw new Error(`${cmd} failed (${code})`);
}
const mode = process.argv[2];
const data = await mkdtemp(path.join(tmpdir(), "planner2-e2e-"));
const probe = net.createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const baseURL = `http://127.0.0.1:${port}`;
const env = { ...process.env, PLANNER_DATA_DIR: data, BASE_URL: baseURL };
let stopResolve;
const stopped = new Promise((resolve) => {
  stopResolve = resolve;
});
const stop = () => {
  active?.kill("SIGTERM");
  stopResolve();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  if (mode !== "inspect") {
    await run("pnpm", ["build"]);
    if (mode !== "api") await run("pnpm", ["build-storybook"]);
  }
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { stdio: "inherit", env },
  );
  let ready = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      ready = (await fetch(`${baseURL}/api/projects`)).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("Owned server did not start");
  console.log(`OWNED_SERVER=${baseURL} DATA=${data}`);
  if (mode === "inspect") await stopped;
  else {
    await mkdir("e2e/bruno-api-tests/reports", { recursive: true });
    await run(
      path.resolve("node_modules/.bin/bru"),
      [
        "run",
        "--env",
        "local",
        "--env-var",
        `baseUrl=${baseURL}`,
        "--reporter-json",
        "reports/results.json",
      ],
      env,
      path.resolve("e2e/bruno-api-tests"),
    );
    if (mode !== "api") await run("pnpm", ["exec", "playwright", "test"], env);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
  await rm(data, { recursive: true, force: true });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}

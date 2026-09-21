import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

test("E2E-07 actual server restart preserves SQLite documents, checks and template deletions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "planner-restart-"));
  let server: ChildProcess | undefined;
  async function stop() {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await once(server, "exit");
    }
  }
  async function start() {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((r) => probe.close(() => r()));
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
      { env: { ...process.env, PLANNER_DATA_DIR: dir }, stdio: "ignore" },
    );
    const base = `http://127.0.0.1:${port}`;
    await expect
      .poll(async () => {
        try {
          return (await fetch(`${base}/api/projects`)).status;
        } catch {
          return 0;
        }
      })
      .toBe(200);
    return base;
  }
  async function request(
    base: string,
    endpoint: string,
    method = "GET",
    data?: unknown,
  ) {
    const r = await fetch(base + endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    expect(r.ok, await r.clone().text()).toBe(true);
    return r.json();
  }
  try {
    let base = await start();
    const p = await request(base, "/api/projects", "POST", {
      title: "Persisted project",
    });
    const d = await request(base, "/api/documents", "POST", {
      projectId: p.id,
      title: "Persistent design",
      templateName: "view",
      phase: "design",
    });
    await request(
      base,
      `/api/documents/${d.id}/checklist/${d.checklist[0].id}`,
      "PATCH",
      { aiResult: "passed", expectedRevision: 1 },
    );
    await request(
      base,
      `/api/documents/${d.id}/checklist/${d.checklist[0].id}/confirm`,
      "POST",
      { confirmed: true, expectedRevision: 2 },
    );
    await request(base, "/api/templates/view", "DELETE", {});
    await request(
      base,
      "/api/templates/design-verification-view",
      "DELETE",
      {},
    );
    await stop();
    base = await start();
    const restored = await request(base, `/api/documents/${d.id}`);
    expect(restored.status).toBe("verified");
    expect(restored.checklist[0]).toMatchObject({
      aiResult: "passed",
      humanConfirmed: true,
    });
    expect(restored.templateSnapshot.name).toBe("view");
    expect((await fetch(base + "/api/templates/view")).status).toBe(404);
    expect(
      (await fetch(base + "/api/templates/design-verification-view")).status,
    ).toBe(404);
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const client = new Client({ name: "canvas-ux-validation", version: "1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    "node_modules/@playwright/mcp/cli.js",
    "--headless",
    "--browser",
    "chrome",
    "--isolated",
    "--output-dir",
    "output/playwright",
  ],
  stderr: "pipe",
});
const results = [];
const runLabel =
  path.basename(
    process.argv.find((a) => a.endsWith(".txt")) || "browse",
    ".txt",
  ) +
  "-" +
  Date.now();
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, {
    timeout: 180000,
  });
  const text =
    result.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n") ?? "";
  results.push({ name, text, isError: result.isError ?? false });
  if (result.isError) throw new Error(text);
  return text;
}
try {
  await mkdir("output/playwright", { recursive: true });
  await client.connect(transport);
  const list = await client.listTools();
  await writeFile(
    "output/playwright/mcp-tools.json",
    JSON.stringify(
      list.tools.map((t) => ({ name: t.name, inputSchema: t.inputSchema })),
      null,
      2,
    ),
  );
  await call("browser_navigate", { url: "http://127.0.0.1:3045" });
  const steps = process.argv.slice(2);
  if (!steps.length) console.log(await call("browser_snapshot"));
  for (const step of steps) {
    if (step === "--fixture") {
      const fixture = JSON.parse(
        execFileSync("uv", ["run", "python", "tests/make_browser_fixture.py"], {
          cwd: "../backend-langgraph",
          encoding: "utf8",
        }),
      );
      await call("browser_evaluate", {
        function: `() => { localStorage.clear(); localStorage.setItem('canvas64:workspace:v2', ${JSON.stringify(JSON.stringify(fixture.doc))}); localStorage.setItem('canvas64:threads:v1', ${JSON.stringify(JSON.stringify(fixture.threads))}); }`,
      });
      await call("browser_navigate", { url: "http://127.0.0.1:3045" });
    } else if (step === "--correct") {
      execFileSync(
        "uv",
        ["run", "python", "-m", "agent.fixtures", "correct", "--delta", "1000"],
        { cwd: "../backend-langgraph" },
      );
    } else {
      const code = await readFile(step, "utf8");
      console.log(
        step,
        (await call("browser_run_code_unsafe", { code })).split(
          "### Ran Playwright code",
        )[0],
      );
    }
  }
  await call("browser_take_screenshot", {
    type: "png",
    filename: path.resolve("output/playwright/canvas.png"),
    fullPage: true,
  });
  console.log(await call("browser_console_messages", { level: "error" }));
} catch (error) {
  try {
    await call("browser_take_screenshot", {
      type: "png",
      filename: path.resolve("output/playwright/failure.png"),
      fullPage: true,
    });
    await call("browser_snapshot");
    await call("browser_evaluate", {
      function: "() => Object.fromEntries(Object.entries(localStorage))",
    });
  } catch {}
  throw error;
} finally {
  try {
    await call("browser_close");
    console.log("Test Chrome closed via Playwright MCP browser_close.");
  } finally {
    try {
      await client.close();
    } finally {
      try {
        await transport.close();
      } finally {
        await writeFile(
          `output/playwright/${runLabel}.json`,
          JSON.stringify(results, null, 2),
        );
      }
    }
  }
}

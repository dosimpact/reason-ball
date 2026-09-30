/**
 * Actual Playwright MCP stdio transport for a bounded manual smoke session.
 * Install pinned tools outside the repository, then set PLAYWRIGHT_MCP_HOME.
 * Each stdin line is {"tool":"browser_snapshot","args":{}} or {"close":true}.
 * Authentication is supplied only by a private storage-state file, never stdout.
 */
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

function sanitize(value) {
  if (typeof value === 'string') return value.replace(/(?:cookie|authorization):[^\n]*/gi, '[REDACTED HEADER]');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, sanitize(item)]));
  return value;
}

const toolHome = process.env.PLAYWRIGHT_MCP_HOME;
if (!toolHome) throw new Error('Set PLAYWRIGHT_MCP_HOME to the temporary tool installation directory.');
const dependency = path => pathToFileURL(resolve(toolHome, 'node_modules', path)).href;
const { Client } = await import(dependency('@modelcontextprotocol/sdk/dist/esm/client/index.js'));
const { StdioClientTransport } = await import(dependency('@modelcontextprotocol/sdk/dist/esm/client/stdio.js'));
const evidenceDirectory = resolve(process.env.PLAYWRIGHT_MCP_EVIDENCE ?? '/tmp/mission-playwright-mcp/evidence');
mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
const args = [
  resolve(toolHome, 'node_modules/@playwright/mcp/cli.js'),
  '--headless', '--isolated', '--browser', 'chrome', '--output-dir', evidenceDirectory,
];
if (process.env.PLAYWRIGHT_MCP_STORAGE_STATE) args.push('--storage-state', resolve(process.env.PLAYWRIGHT_MCP_STORAGE_STATE));
const transport = new StdioClientTransport({ command: process.execPath, args, stderr: 'pipe' });
const client = new Client({ name: 'mission-catalog-smoke', version: '1.0.0' });
try {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  process.stdout.write(`${JSON.stringify({ connected: true, server: client.getServerVersion(), tools: tools.map(tool => tool.name) })}\n`);
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (command.close === true) { lines.close(); break; }
      if (!tools.some(tool => tool.name === command.tool)) throw new Error('Unknown Playwright MCP tool.');
      const result = await client.callTool({ name: command.tool, arguments: command.args ?? {} }, undefined, { timeout: 120_000 });
      process.stdout.write(`${JSON.stringify(sanitize(result))}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ error: error instanceof Error ? error.message : 'MCP call failed' })}\n`);
      process.exitCode = 1;
    }
  }
} finally {
  await client.close();
}

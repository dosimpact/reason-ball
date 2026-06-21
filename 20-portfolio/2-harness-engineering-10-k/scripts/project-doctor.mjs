import { spawnSync } from "node:child_process";
import {
  constants as fsConstants,
  accessSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";

const args = new Set(process.argv.slice(2));
const runChecks = args.has("--run-checks");
const runE2e = args.has("--run-e2e");
const probeServices = args.has("--probe-services");
const outputJson = args.has("--json");

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: pnpm run doctor [-- --run-checks] [-- --run-e2e] [-- --probe-services] [-- --json]

Default mode performs static project contract checks for all numbered targets.
--run-checks runs build, unit, lint, syntax, and whitespace gates.
--run-e2e also runs the full Playwright E2E gate.
--probe-services fails if required local TCP/HTTP service probes are unavailable.`);
  process.exit(0);
}

const targetIds = [
  "0-harness",
  "1-infra-graph-rag",
  "2-10-k-collector",
  "3-10-k-parser",
  "4-10-k-chat-bot-next",
];

const defaultEnv = {
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
    process.env.COLLECTOR_DATA_DIR || join(root, "2-10-k-collector"),
};

function relPath(path) {
  return join(root, path);
}

function readText(path) {
  return readFileSync(relPath(path), "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readEnvExample(path) {
  const values = new Map();

  for (const line of readText(path).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    values.set(
      trimmed.slice(0, separatorIndex),
      trimmed.slice(separatorIndex + 1),
    );
  }

  return values;
}

function createTarget(id, label, directory) {
  return {
    id,
    label,
    directory,
    checks: [],
    warnings: [],
    failures: [],
    info: [],
  };
}

function pass(target, message) {
  target.checks.push(message);
}

function warn(target, message) {
  target.warnings.push(message);
}

function fail(target, message) {
  target.failures.push(message);
}

function info(target, message) {
  target.info.push(message);
}

function expectFile(target, path, recovery) {
  if (existsSync(relPath(path))) {
    pass(target, `found ${path}`);
    return true;
  }

  fail(target, `missing ${path}; ${recovery}`);
  return false;
}

function expectNoFile(target, path, recovery) {
  if (existsSync(relPath(path))) {
    fail(target, `${path} should not exist; ${recovery}`);
  } else {
    pass(target, `${path} is absent`);
  }
}

function expectPdcaReportDocuments(target) {
  const statusPath = "docs/.pdca-status.json";
  if (!expectFile(target, statusPath, "restore PDCA status file")) {
    return;
  }

  let status;
  try {
    status = readJson(statusPath);
    pass(target, "PDCA status JSON is parseable");
  } catch (error) {
    fail(target, `could not parse ${statusPath}: ${error.message}`);
    return;
  }

  const reportFeatures = Object.entries(status.features ?? {}).filter(
    ([, feature]) => feature?.phase === "report",
  );

  if (reportFeatures.length === 0) {
    info(target, "no PDCA feature is currently in report phase");
    return;
  }

  for (const [featureName, feature] of reportFeatures) {
    const reportPath = feature.documents?.report;

    if (!reportPath) {
      fail(
        target,
        `PDCA report document is missing for report-phase feature ${featureName}`,
      );
      continue;
    }

    pass(target, `PDCA report document linked for ${featureName}`);
    expectFile(
      target,
      reportPath,
      `restore PDCA report document for ${featureName}`,
    );
  }
}

function expectExecutable(target, path, recovery) {
  if (!expectFile(target, path, recovery)) {
    return;
  }

  try {
    accessSync(relPath(path), fsConstants.X_OK);
    pass(target, `${path} is executable`);
  } catch {
    fail(target, `${path} is not executable; ${recovery}`);
  }
}

function expectPackage(target, path, expectedName) {
  if (!expectFile(target, path, `restore ${path} before running package checks`)) {
    return null;
  }

  try {
    const pkg = readJson(path);
    if (pkg.name === expectedName) {
      pass(target, `package name is ${expectedName}`);
    } else {
      fail(target, `package name should be ${expectedName}, got ${pkg.name}`);
    }

    if (pkg.private === true) {
      pass(target, "package is private");
    } else {
      warn(target, "package is not marked private");
    }

    return pkg;
  } catch (error) {
    fail(target, `could not parse ${path}: ${error.message}`);
    return null;
  }
}

function expectScripts(target, pkg, requiredScripts, optionalScripts = []) {
  if (!pkg?.scripts) {
    fail(target, "package scripts are missing");
    return;
  }

  for (const scriptName of requiredScripts) {
    if (pkg.scripts[scriptName]) {
      pass(target, `script ${scriptName} exists`);
    } else {
      fail(target, `script ${scriptName} is missing`);
    }
  }

  for (const scriptName of optionalScripts) {
    if (pkg.scripts[scriptName]) {
      pass(target, `optional script ${scriptName} exists`);
    } else {
      warn(target, `optional script ${scriptName} is missing`);
    }
  }
}

function expectEnvKeys(target, path, expected) {
  if (!expectFile(target, path, `restore ${path} before env checks`)) {
    return new Map();
  }

  const env = readEnvExample(path);
  for (const key of expected) {
    if (env.has(key)) {
      pass(target, `env example includes ${key}`);
    } else {
      fail(target, `env example is missing ${key}`);
    }
  }

  return env;
}

function expectEnvValue(target, env, key, expected) {
  const actual = env.get(key);
  if (actual === expected) {
    pass(target, `${key} defaults to ${expected}`);
  } else {
    fail(target, `${key} should default to ${expected}, got ${actual ?? "missing"}`);
  }
}

function expectText(target, path, label, patterns, severity = "fail") {
  if (!expectFile(target, path, `restore ${path} before text checks`)) {
    return;
  }

  const text = readText(path);
  for (const pattern of patterns) {
    const found =
      typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
    const patternLabel = typeof pattern === "string" ? pattern : pattern.source;

    if (found) {
      pass(target, `${label} includes ${patternLabel}`);
    } else if (severity === "warn") {
      warn(target, `${label} does not include ${patternLabel}`);
    } else {
      fail(target, `${label} does not include ${patternLabel}`);
    }
  }
}

function expectNoText(target, path, label, patterns) {
  if (!expectFile(target, path, `restore ${path} before text checks`)) {
    return;
  }

  const text = readText(path);
  for (const pattern of patterns) {
    const found =
      typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
    const patternLabel = typeof pattern === "string" ? pattern : pattern.source;

    if (found) {
      fail(target, `${label} still includes stale value ${patternLabel}`);
    } else {
      pass(target, `${label} does not include stale value ${patternLabel}`);
    }
  }
}

function expectNextEnvRouteTypes(target) {
  const path = "4-10-k-chat-bot-next/next-env.d.ts";
  const label = "chatbot Next env file";
  const productionRouteTypes = "./.next/types/routes.d.ts";
  const devRouteTypes = "./.next/dev/types/routes.d.ts";

  if (!expectFile(target, path, `restore ${path} before Next env checks`)) {
    return;
  }

  const text = readText(path);
  const hasProductionRouteTypes = text.includes(productionRouteTypes);
  const hasDevRouteTypes = text.includes(devRouteTypes);

  if (probeServices) {
    if (hasProductionRouteTypes || hasDevRouteTypes) {
      pass(
        target,
        `${label} includes ${
          hasDevRouteTypes ? devRouteTypes : productionRouteTypes
        }`,
      );
    } else {
      fail(
        target,
        `${label} should include ${productionRouteTypes} or ${devRouteTypes}`,
      );
    }

    if (hasDevRouteTypes) {
      info(
        target,
        `${label} is in live Next dev mode; preserve-next-env.sh restores the snapshot when dev exits`,
      );
    }
    return;
  }

  if (hasProductionRouteTypes) {
    pass(target, `${label} includes ${productionRouteTypes}`);
  } else {
    fail(target, `${label} does not include ${productionRouteTypes}`);
  }

  if (hasDevRouteTypes) {
    fail(target, `${label} still includes stale value ${devRouteTypes}`);
  } else {
    pass(target, `${label} does not include stale value ${devRouteTypes}`);
  }
}

function expectWorkspacePackages(target) {
  if (!expectFile(target, "pnpm-workspace.yaml", "restore workspace manifest")) {
    return;
  }

  const text = readText("pnpm-workspace.yaml");
  for (const workspacePackage of targetIds.slice(1)) {
    if (text.includes(`"${workspacePackage}"`)) {
      pass(target, `workspace includes ${workspacePackage}`);
    } else {
      fail(target, `workspace is missing ${workspacePackage}`);
    }
  }
}

function addServicePathInfo(target, paths) {
  for (const path of paths) {
    info(target, `smoke path: ${path}`);
  }
}

function runCommand(command, args, label) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ...defaultEnv,
    },
    stdio: outputJson ? "pipe" : "inherit",
  });

  const durationMs = Date.now() - startedAt;
  return {
    label,
    command: [command, ...args].join(" "),
    status: result.status,
    signal: result.signal,
    durationMs,
    stdout: result.stdout,
    stderr: result.stderr,
    ok: result.status === 0,
  };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getJsonPath(value, path) {
  if (!path) {
    return { found: true, value };
  }

  let current = value;
  for (const segment of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }

  return { found: true, value: current };
}

function jsonValueType(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function evaluateJsonExpectation(body, expectation) {
  const { found, value } = getJsonPath(body, expectation.path);
  const label = expectation.path || "$";

  if (!found) {
    return `${label} is missing`;
  }

  if ("equals" in expectation && value !== expectation.equals) {
    return `${label} expected ${JSON.stringify(expectation.equals)}, got ${JSON.stringify(value)}`;
  }

  if (expectation.type) {
    const actualType = jsonValueType(value);
    if (actualType !== expectation.type) {
      return `${label} expected type ${expectation.type}, got ${actualType}`;
    }
  }

  if (expectation.notEmpty && (typeof value !== "string" || value.trim() === "")) {
    return `${label} expected a non-empty string`;
  }

  if ("min" in expectation && (typeof value !== "number" || value < expectation.min)) {
    return `${label} expected number >= ${expectation.min}, got ${JSON.stringify(value)}`;
  }

  return null;
}

async function assertProbeJson(response, expectations) {
  if (!expectations?.length) {
    return {
      matched: true,
      count: 0,
      failures: [],
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      matched: false,
      count: expectations.length,
      failures: [`expected JSON response, got content-type ${contentType || "missing"}`],
    };
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    return {
      matched: false,
      count: expectations.length,
      failures: [
        `could not parse JSON body: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const failures = expectations
    .map((expectation) => evaluateJsonExpectation(body, expectation))
    .filter(Boolean);

  return {
    matched: failures.length === 0,
    count: expectations.length,
    failures,
  };
}

async function probeUrl(probe) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  const headers = probe.requestId
    ? {
        "x-request-id": probe.requestId,
      }
    : undefined;

  try {
    const response = await fetch(probe.url, { headers, signal: controller.signal });
    const responseRequestId = response.headers.get("x-request-id") ?? undefined;
    const requestIdMatched =
      !probe.expectRequestIdEcho || responseRequestId === probe.requestId;
    const jsonAssertions = await assertProbeJson(response, probe.expectJson);

    return {
      ok: response.ok && requestIdMatched && jsonAssertions.matched,
      status: response.status,
      statusText: response.statusText,
      ...(probe.requestId ? { requestId: probe.requestId } : {}),
      ...(responseRequestId ? { responseRequestId } : {}),
      ...(probe.expectRequestIdEcho ? { requestIdMatched } : {}),
      ...(probe.expectJson
        ? {
            jsonAssertionsMatched: jsonAssertions.matched,
            jsonAssertionsChecked: jsonAssertions.count,
            ...(jsonAssertions.failures.length
              ? { jsonAssertionFailures: jsonAssertions.failures }
              : {}),
          }
        : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function probeTcp(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        ok: false,
        error: `timed out connecting to ${host}:${port}`,
      });
    }, 2_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve({ ok: true });
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

async function probeOnce(probe) {
  return probe.kind === "tcp"
    ? probeTcp(probe.host, probe.port)
    : probeUrl(probe);
}

async function probeWithRetry(probe) {
  const effectiveProbe =
    probe.kind === "http" && probe.expectRequestIdEcho && !probe.requestId
      ? {
          ...probe,
          requestId: `doctor-probe-${probe.targetId}-${Date.now().toString(36)}`,
        }
      : probe;
  const attempts = parsePositiveInteger(
    process.env.DOCTOR_PROBE_ATTEMPTS,
    effectiveProbe.attempts ?? 1,
  );
  const delayMs = parsePositiveInteger(
    process.env.DOCTOR_PROBE_DELAY_MS,
    effectiveProbe.delayMs ?? 1_000,
  );
  const startedAt = Date.now();
  let result = { ok: false, error: "probe did not run" };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await probeOnce(effectiveProbe);

    if (result.ok || attempt === attempts) {
      return {
        ...result,
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      };
    }

    await sleep(delayMs);
  }

  return {
    ...result,
    attempts,
    durationMs: Date.now() - startedAt,
  };
}

async function waitForParserCollectorCorrelation() {
  const requestId = `doctor-correlation-${Date.now().toString(36)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const response = await fetch("http://127.0.0.1:3406/api/parser/collector/parse-jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        page: 1,
        pageSize: 1,
        since: "2999-01-01",
        dry_run: true,
      }),
      signal: controller.signal,
    });
    const responseRequestId = response.headers.get("x-request-id") ?? undefined;
    const created = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        requestId,
        responseRequestId,
        status: response.status,
        error: "could not create parser collector correlation job",
        body: created,
      };
    }

    if (responseRequestId !== requestId || created.correlationId !== requestId) {
      return {
        ok: false,
        requestId,
        responseRequestId,
        createdCorrelationId: created.correlationId,
        error: "parser did not preserve the inbound request ID on job creation",
      };
    }

    const jobId = created.jobId;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await sleep(500);
      const statusResponse = await fetch(
        `http://127.0.0.1:3406/api/parser/collector/parse-jobs/${jobId}`,
        {
          headers: { "x-request-id": requestId },
        },
      );
      const statusResponseRequestId = statusResponse.headers.get("x-request-id") ?? undefined;
      const job = await statusResponse.json();
      const terminal = ["completed", "completed_with_errors", "failed"].includes(job.status);

      if (!terminal) {
        continue;
      }

      const collectorRequestIds = Array.isArray(job.collectorRequestIds)
        ? job.collectorRequestIds
        : [];
      return {
        ok:
          statusResponse.ok &&
          statusResponseRequestId === requestId &&
          job.correlationId === requestId &&
          job.collectorRequestIdMatched === true &&
          collectorRequestIds.length >= 2,
        requestId,
        responseRequestId,
        statusResponseRequestId,
        jobId,
        jobStatus: job.status,
        collectorRequestIds,
        collectorRequestIdMatched: job.collectorRequestIdMatched,
        attempts: attempt,
      };
    }

    return {
      ok: false,
      requestId,
      responseRequestId,
      jobId,
      error: "parser collector correlation job did not finish before timeout",
    };
  } catch (error) {
    return {
      ok: false,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function maybeProbeServices(targets) {
  if (!probeServices) {
    for (const target of targets) {
      if (target.id !== "0-harness") {
        info(
          target,
          "service probe skipped; run pnpm run doctor -- --probe-services after starting services",
        );
      }
    }
    return;
  }

  const probes = [
    {
      targetId: "1-infra-graph-rag",
      kind: "tcp",
      label: "PostgreSQL TCP",
      host: "127.0.0.1",
      port: 55432,
      recovery: "start infra with pnpm run infra:up",
      attempts: 3,
      delayMs: 500,
    },
    {
      targetId: "1-infra-graph-rag",
      kind: "tcp",
      label: "Neo4j Bolt TCP",
      host: "127.0.0.1",
      port: 7687,
      recovery: "start infra with pnpm run infra:up",
      attempts: 3,
      delayMs: 500,
    },
    {
      targetId: "1-infra-graph-rag",
      kind: "http",
      label: "Neo4j Browser HTTP",
      url: "http://127.0.0.1:7474",
      recovery: "start infra with pnpm run infra:up",
      attempts: 6,
      delayMs: 1_000,
    },
    {
      targetId: "1-infra-graph-rag",
      kind: "http",
      label: "Loki ready HTTP",
      url: "http://127.0.0.1:3100/ready",
      recovery: "start infra with pnpm run infra:up",
      attempts: 20,
      delayMs: 1_000,
    },
    {
      targetId: "1-infra-graph-rag",
      kind: "http",
      label: "Grafana health HTTP",
      url: "http://127.0.0.1:3001/api/health",
      recovery: "start infra with pnpm run infra:up",
      attempts: 10,
      delayMs: 1_000,
    },
    {
      targetId: "2-10-k-collector",
      kind: "http",
      label: "Collector filing status API",
      url: "http://127.0.0.1:3305/api/filings/status-summary",
      recovery: "start collector with pnpm --filter @10k/collector run dev",
      attempts: 10,
      delayMs: 1_000,
      expectRequestIdEcho: true,
      expectJson: [
        { path: "filters", type: "object" },
        { path: "total", type: "number", min: 0 },
        { path: "pending", type: "number", min: 0 },
        { path: "downloaded", type: "number", min: 0 },
        { path: "failed", type: "number", min: 0 },
      ],
    },
    {
      targetId: "3-10-k-parser",
      kind: "http",
      label: "Parser health API",
      url: "http://127.0.0.1:3406/health",
      recovery: "start parser with pnpm --filter @10k/parser run dev",
      attempts: 10,
      delayMs: 1_000,
      expectRequestIdEcho: true,
      expectJson: [
        { path: "status", equals: "ok" },
        { path: "service", equals: "10-k-parser" },
        { path: "jobStore.maxJobs", type: "number", min: 1 },
        { path: "jobStore.ttlSeconds", type: "number", min: 1 },
        { path: "runtimeStore.dbPath", type: "string", notEmpty: true },
        { path: "runtimeStore.threads", type: "number", min: 0 },
        { path: "runtimeStore.runs", type: "number", min: 0 },
        { path: "runtimeStore.maxThreads", type: "number", min: 1 },
        { path: "runtimeStore.retentionDays", type: "number", min: 1 },
        { path: "runtimeStore.foreignKeyCascade", equals: true },
      ],
    },
    {
      targetId: "4-10-k-chat-bot-next",
      kind: "http",
      label: "Chatbot CopilotKit info API",
      url: "http://127.0.0.1:3003/api/copilotkit/info",
      recovery: "start chatbot with pnpm --filter @10k/chatbot run dev",
      attempts: 20,
      delayMs: 1_000,
      expectRequestIdEcho: true,
      expectJson: [{ path: "", type: "object" }],
    },
  ];

  const probeResults = await Promise.all(
    probes.map(async (probe) => ({
      probe,
      result: await probeWithRetry(probe),
    })),
  );

  for (const { probe, result } of probeResults) {
    const target = targets.find((item) => item.id === probe.targetId);
    if (!target) {
      continue;
    }

    const attemptsSuffix =
      result.attempts > 1 ? ` after ${result.attempts} attempts` : "";

    if (result.ok) {
      const jsonSuffix =
        result.jsonAssertionsChecked > 0
          ? `; JSON body matched ${result.jsonAssertionsChecked} assertions`
          : "";
      pass(
        target,
        `service probe passed: ${probe.label} (${probe.url ?? `${probe.host}:${probe.port}`})${attemptsSuffix}${jsonSuffix}`,
      );
    } else {
      fail(
        target,
        `service probe failed: ${probe.label} (${probe.url ?? `${probe.host}:${probe.port}`}); ${probe.recovery}; result ${JSON.stringify(result)}`,
      );
    }
  }

  const parserTarget = targets.find((item) => item.id === "3-10-k-parser");
  if (parserTarget) {
    const result = await waitForParserCollectorCorrelation();
    if (result.ok) {
      const attemptsSuffix =
        result.attempts > 1 ? ` after ${result.attempts} polls` : "";
      pass(
        parserTarget,
        `service probe passed: Parser to collector request ID correlation${attemptsSuffix}; collector echoed ${result.collectorRequestIds.length} request IDs`,
      );
    } else {
      fail(
        parserTarget,
        `service probe failed: Parser to collector request ID correlation; start parser and collector with pnpm run dev; result ${JSON.stringify(result)}`,
      );
    }
  }
}

function checkHarness() {
  const target = createTarget("0-harness", "workspace orchestration", ".");
  const pkg = expectPackage(target, "package.json", "@10k/workspace");
  expectScripts(target, pkg, [
    "infra",
    "infra:up",
    "infra:down",
    "dev",
    "build",
    "start",
    "test:unit",
    "test:e2e",
    "test:graph-rag",
    "doctor",
    "doctor:verify",
    "doctor:probe",
    "doctor:probe:local",
  ]);
  expectWorkspacePackages(target);
  expectFile(target, "turbo.json", "restore turbo task graph");
  expectFile(target, "pnpm-lock.yaml", "run pnpm install to recreate lockfile");
  expectFile(target, "scripts/test-e2e.mjs", "restore e2e orchestrator");
  expectText(target, "scripts/test-e2e.mjs", "e2e runner generated file hygiene", [
    "snapshotNextEnv",
    "restoreNextEnv",
    "10k-e2e-next-env-",
  ]);
  expectText(target, "scripts/test-e2e.mjs", "e2e runner Playwright orchestration", [
    "PLAYWRIGHT_SKIP_WEBSERVER",
    "CHATBOT_BASE_URL",
    "PORT: process.env.PORT || \"3003\"",
  ]);
  expectFile(
    target,
    "scripts/run-doctor-probe.mjs",
    "restore the self-contained live doctor probe runner",
  );
  expectText(target, "scripts/run-doctor-probe.mjs", "doctor probe lifecycle runner", [
    "doctor:probe",
    "snapshotNextEnv",
    "restoreNextEnv",
    "waitForHttp",
    "cleanup",
    "infra:down",
  ]);
  expectExecutable(
    target,
    "scripts/validate-parser-langgraph-e2e.sh",
    "run chmod +x scripts/validate-parser-langgraph-e2e.sh",
  );
  expectText(target, "scripts/validate-parser-langgraph-e2e.sh", "parser LangGraph validation script", [
    "http://127.0.0.1:3406",
    "http://127.0.0.1:3003",
  ]);
  expectNoText(target, "scripts/validate-parser-langgraph-e2e.sh", "parser LangGraph validation script", [
    "http://127.0.0.1:3306",
    "http://127.0.0.1:3300",
  ]);
  expectFile(target, "scripts/init-postgres.sh", "restore database bootstrap script");
  expectPdcaReportDocuments(target);
  expectFile(target, "docs/05-runbooks/operations.md", "restore operations runbook");
  expectText(target, ".gitignore", "root gitignore", [
    "/data/runtime.db",
    "/logs/",
    "*.egg-info/",
    "*.tsbuildinfo",
  ]);
  expectText(target, "README.md", "root README", targetIds.slice(1));
  expectText(target, "docs/05-runbooks/operations.md", "operations runbook", [
    "Release Gate",
    "Generated Runtime Artifacts",
    "Missing or Stale Filing Metadata",
    "Parser Runtime Unavailable",
    "Graph RAG or Neo4j Retrieval Failure",
    "Request ID Log Correlation",
    "sec_api_problem",
  ]);
  expectText(target, "package.json", "root package scripts", [
    "http://127.0.0.1:3406",
    "127.0.0.1:55432",
  ]);
  expectFile(
    target,
    ".github/workflows/project-gates.yml",
    "restore GitHub Actions release gate workflow",
  );
  expectText(target, ".github/workflows/project-gates.yml", "GitHub Actions project gates", [
    "actions/checkout@v5",
    "actions/setup-node@v6",
    "pnpm/action-setup@v6",
    "node-version: \"24\"",
    "pnpm install --frozen-lockfile",
    "pnpm run doctor:verify",
    "pnpm run test:e2e",
    "pnpm run test:graph-rag",
    "workflow_dispatch",
    "schedule",
  ]);
  expectText(target, "scripts/project-doctor.mjs", "project doctor probe contracts", [
    "expectJson",
    "jsonAssertionsMatched",
    "waitForParserCollectorCorrelation",
    "runtimeStore.foreignKeyCascade",
    "jobStore.maxJobs",
    "filings/status-summary",
    "PDCA report document",
  ]);
  expectFile(
    target,
    "scripts/test-parser-collector-graph-rag.mjs",
    "restore real SEC parser-to-Graph-RAG smoke script",
  );
  expectText(target, "scripts/test-parser-collector-graph-rag.mjs", "parser collector graph smoke", [
    "parser-collector-graph-rag",
    "LLM_PROVIDER",
    "mock",
    "init-neo4j",
    "filing-sync-jobs",
    "filing-download-jobs",
    "waitForNeo4jBolt",
    "cypher-shell",
    "dry_run: false",
    "/api/graph-rag/query",
    "selectedFiling?.filingId",
    "evidence.every",
    "assertEvidenceQuality",
    "evidenceLimit=4",
    "Graph RAG answer did not include focus",
    "textLength",
  ]);
  addServicePathInfo(target, [
    "pnpm run build",
    "pnpm run test:unit",
    "pnpm run test:e2e",
    "pnpm run test:graph-rag",
  ]);
  return target;
}

function checkInfra() {
  const target = createTarget(
    "1-infra-graph-rag",
    "local database and graph infrastructure",
    "1-infra-graph-rag",
  );
  const pkg = expectPackage(
    target,
    "1-infra-graph-rag/package.json",
    "@10k/infra",
  );
  expectScripts(target, pkg, [
    "infra:up",
    "infra:down",
    "infra:ps",
    "build",
    "test:unit",
    "clean",
  ]);
  const env = expectEnvKeys(target, "1-infra-graph-rag/.env.example", [
    "NEO4J_HTTP_PORT",
    "NEO4J_BOLT_PORT",
    "LOKI_HTTP_PORT",
    "POSTGRES_PORT",
    "GRAFANA_HTTP_PORT",
  ]);
  expectEnvValue(target, env, "POSTGRES_PORT", "55432");
  expectEnvValue(target, env, "GRAFANA_HTTP_PORT", "3001");
  expectText(target, "1-infra-graph-rag/docker-compose.yml", "compose", [
    "neo4j:",
    "postgres:",
    "grafana:",
    "loki:",
    "${POSTGRES_PORT:-55432}:5432",
    "${GRAFANA_HTTP_PORT:-3001}:3000",
  ]);
  expectText(target, "1-infra-graph-rag/README.md", "infra README", [
    "pnpm run infra:up",
    "http://localhost:3001",
    "../docs/05-runbooks/operations.md",
  ]);
  addServicePathInfo(target, [
    "pnpm --filter @10k/infra run infra:ps",
    "Neo4j Browser http://127.0.0.1:7474",
    "Loki ready http://127.0.0.1:3100/ready",
  ]);
  return target;
}

function checkCollector() {
  const target = createTarget(
    "2-10-k-collector",
    "SEC metadata and filing collector",
    "2-10-k-collector",
  );
  const pkg = expectPackage(
    target,
    "2-10-k-collector/package.json",
    "@10k/collector",
  );
  expectScripts(target, pkg, [
    "build",
    "typecheck",
    "dev",
    "start",
    "start:dev",
    "companies:sync",
    "filings:collect",
    "test:unit",
  ]);
  const env = expectEnvKeys(target, "2-10-k-collector/.env.example", [
    "DATABASE_URL",
    "APP_PORT",
    "SEC_USER_AGENT",
    "SEC_RATE_LIMIT_RPS",
    "DATA_DIR",
  ]);
  expectEnvValue(target, env, "APP_PORT", "3305");
  expectExecutable(
    target,
    "2-10-k-collector/scripts/with-local-env.sh",
    "restore the collector local environment wrapper",
  );
  expectText(target, "2-10-k-collector/scripts/with-local-env.sh", "collector local env wrapper", [
    "POSTGRES_PORT",
    "55432",
    "DATABASE_URL",
  ]);
  expectText(target, "2-10-k-collector/package.json", "collector package scripts", [
    "scripts/with-local-env.sh",
  ]);
  expectText(target, "2-10-k-collector/README.md", "collector README", [
    "company-sync-jobs",
    "filing-sync-jobs",
    "filing-download-jobs",
    "filing-retry-jobs",
    "filings/status-summary",
    "--tickers AAPL,MSFT",
    "TypeORM migration",
    "synchronize",
  ]);
  expectNoText(target, "2-10-k-collector/README.md", "collector README", [
    "synchronize: true",
  ]);
  expectText(target, "2-10-k-collector/src/common/db/database.module.ts", "collector database module", [
    "migrationsRun: true",
    "synchronize: false",
  ]);
  expectFile(
    target,
    "2-10-k-collector/src/main.ts",
    "restore NestJS entrypoint",
  );
  expectText(target, "2-10-k-collector/src/main.ts", "collector entrypoint", [
    "collector_http_request",
    "x-request-id",
    "--tickers",
    "--ciks",
  ]);
  expectText(target, "2-10-k-collector/src/api/collector.controller.ts", "collector controller", [
    "correlationId",
    "x-request-id",
    "readOptionalTickerList",
    "parserStatus",
  ]);
  expectText(target, "2-10-k-collector/src/filings-collector/filings-collector.service.ts", "collector targeted filing sync", [
    "resolveTargetCiks",
    "tickers",
    "No companies found for ciks=",
    /downloadPending\(\{[\s\S]*since: options\.since/,
    "filing.parser_status = :parserStatus",
  ]);
  expectText(target, "2-10-k-collector/src/api/dto/swagger.dto.ts", "collector Swagger DTOs", [
    "DownloadedReportsFilterDto",
    "parserStatus",
  ]);
  expectFile(
    target,
    "2-10-k-collector/src/common/db/migrations",
    "restore collector database migrations",
  );
  addServicePathInfo(target, [
    "curl -s http://127.0.0.1:3305/api/filings/status-summary",
    "curl -s -X POST http://127.0.0.1:3305/api/company-sync-jobs",
    "curl -s -X POST http://127.0.0.1:3305/api/filing-download-jobs",
  ]);
  return target;
}

function checkParser() {
  const target = createTarget(
    "3-10-k-parser",
    "parser, graph retrieval, and LangGraph-style runtime",
    "3-10-k-parser",
  );
  const pkg = expectPackage(target, "3-10-k-parser/package.json", "@10k/parser");
  expectScripts(target, pkg, [
    "python:sync",
    "dev",
    "build",
    "start",
    "test:unit",
  ]);
  const env = expectEnvKeys(target, "3-10-k-parser/.env.example", [
    "NEO4J_URI",
    "APP_PORT",
    "COLLECTOR_API_BASE_URL",
    "LLM_PROVIDER",
    "MOCK_DOCUMENTS_PATH",
    "PARSER_BACKEND_BASE_URL",
    "PARSER_JOB_STORE_MAX_JOBS",
    "PARSER_JOB_STORE_TTL_SECONDS",
    "RUNTIME_DB_PATH",
    "RUNTIME_STORE_MAX_THREADS",
    "RUNTIME_STORE_RETENTION_DAYS",
  ]);
  expectEnvValue(target, env, "APP_PORT", "3406");
  expectEnvValue(target, env, "NEO4J_URI", "bolt://127.0.0.1:7687");
  expectEnvValue(target, env, "PARSER_BACKEND_BASE_URL", "http://localhost:3406");
  expectEnvValue(target, env, "MOCK_DOCUMENTS_PATH", "./examples/mock_documents.json");
  expectEnvValue(target, env, "RUNTIME_DB_PATH", "./data/runtime.db");
  expectEnvValue(target, env, "RUNTIME_STORE_MAX_THREADS", "500");
  expectEnvValue(target, env, "RUNTIME_STORE_RETENTION_DAYS", "30");
  expectFile(target, "3-10-k-parser/pyproject.toml", "restore uv project file");
  expectText(target, "3-10-k-parser/.gitignore", "parser gitignore", [
    ".env",
    "data/",
    "logs/",
  ]);
  expectFile(
    target,
    "3-10-k-parser/src/parser/api/langgraph_router.py",
    "restore LangGraph runtime router",
  );
  expectFile(
    target,
    "3-10-k-parser/src/parser/api/graph_rag_router.py",
    "restore Graph RAG router",
  );
  expectText(target, "3-10-k-parser/src/parser/api/models.py", "Graph RAG request model", [
    "selected_filing",
    "selectedFiling",
  ]);
  expectText(target, "3-10-k-parser/src/parser/api/graph_rag_router.py", "Graph RAG selected filing scope", [
    "selected_filing=req.selected_filing",
  ]);
  expectText(target, "3-10-k-parser/src/parser/api/server.py", "parser API server", [
    "parser_http_request",
    "x-request-id",
    "correlationId",
    "PARSER_JOB_STORE_MAX_JOBS",
    "PARSER_JOB_STORE_TTL_SECONDS",
    "runtimeStore",
  ]);
  expectNoText(target, "3-10-k-parser/src/parser/core/config.py", "parser config", [
    "http://localhost:3306",
    "./data/mock_documents.json",
  ]);
  expectText(target, "3-10-k-parser/src/parser/core/config.py", "parser config", [
    "Path(__file__).resolve().parents[3]",
    "examples",
    "runtime.db",
    "runtime_store_max_threads",
    "runtime_store_retention_days",
    "http://localhost:3406",
    "bolt://127.0.0.1:7687",
  ]);
  expectText(target, "3-10-k-parser/src/parser/core/job_store.py", "parser job store", [
    "max_jobs",
    "ttl_seconds",
    "TERMINAL_STATUSES",
  ]);
  expectText(target, "3-10-k-parser/src/parser/runtime/store.py", "parser runtime store", [
    "dbPath",
    "maxThreads",
    "retentionDays",
    "foreignKeyCascade",
    "PRAGMA foreign_keys = ON",
    "ON DELETE CASCADE",
    "idx_runtime_run_thread_id_created_at",
    "idx_runtime_thread_updated_at",
    "runtime_thread",
    "runtime_run",
  ]);
  expectText(target, "3-10-k-parser/package.json", "parser package test script", [
    "scripts/runtime_store_smoke.py",
    "scripts/retrieval_scope_smoke.py",
  ]);
  expectText(target, "3-10-k-parser/scripts/runtime_store_smoke.py", "parser runtime store smoke", [
    "runtime_store_fresh_schema_smoke=pass",
    "runtime_store_legacy_migration_smoke=pass",
    "collector_client_request_id_smoke=pass",
    "collector_downloaded_reports_parser_status_smoke=pass",
    "foreignKeyCascade",
    "assert_runtime_run_cascade",
    "idx_runtime_run_thread_id_created_at",
    "idx_runtime_thread_updated_at",
    "orphan-run",
  ]);
  expectText(target, "3-10-k-parser/scripts/retrieval_scope_smoke.py", "parser retrieval scope smoke", [
    "retrieval_selected_filing_scope_smoke=pass",
    "retrieval_unresolved_selected_filing_smoke=pass",
    "acc:000TARGET-26-000001",
    "Distractor risk should not leak",
  ]);
  expectText(target, "3-10-k-parser/src/parser/application/jobs.py", "parser collector parse job", [
    "parser_collector_parse_job",
    "correlationId",
    "parserStatus",
    "collectorPreflightSampleCount",
    "collectorRequestIds",
    "collectorRequestIdMatched",
  ]);
  expectText(target, "3-10-k-parser/src/parser/collector/client.py", "parser collector client", [
    "x-request-id",
    "correlation_id",
    "response_request_ids",
    "parserStatus",
  ]);
  expectFile(
    target,
    "3-10-k-parser/src/parser/retrieval",
    "restore retrieval layer",
  );
  expectText(
    target,
    "3-10-k-parser/src/parser/retrieval/service.py",
    "Graph RAG selected filing metadata preservation",
    ["_merge_selected_filing_hint", "company_name"],
  );
  expectFile(
    target,
    "3-10-k-parser/src/parser/runtime",
    "restore runtime state layer",
  );
  expectFile(
    target,
    "3-10-k-parser/bruno-api-tests/langgraph",
    "restore LangGraph Bruno tests",
  );
  expectText(target, "3-10-k-parser/bruno-api-tests/environments/local.bru", "parser Bruno local env", [
    "http://127.0.0.1:3406",
  ]);
  expectNoText(target, "3-10-k-parser/bruno-api-tests/environments/local.bru", "parser Bruno local env", [
    "http://127.0.0.1:3306",
  ]);
  expectText(
    target,
    "3-10-k-parser/postman/3-10-k-parser.local.postman_environment.json",
    "parser Postman local env",
    ["http://127.0.0.1:3406"],
  );
  expectNoText(
    target,
    "3-10-k-parser/postman/3-10-k-parser.local.postman_environment.json",
    "parser Postman local env",
    ["http://127.0.0.1:3306"],
  );
  expectText(
    target,
    "3-10-k-parser/postman/3-10-k-parser.postman_collection.json",
    "parser Postman collection",
    ["http://127.0.0.1:3406"],
  );
  expectNoText(
    target,
    "3-10-k-parser/postman/3-10-k-parser.postman_collection.json",
    "parser Postman collection",
    ["http://127.0.0.1:3306"],
  );
  expectText(target, "3-10-k-parser/docs/context-handoff.md", "parser context handoff", [
    "http://127.0.0.1:3406",
    "pnpm --filter @10k/parser run dev",
  ]);
  expectNoText(target, "3-10-k-parser/docs/context-handoff.md", "parser context handoff", [
    "http://127.0.0.1:3306",
    "--port 3306",
    "pip install -r requirements.txt",
  ]);
  expectText(target, "3-10-k-parser/README.md", "parser README", [
    "http://localhost:3406",
    "pnpm run python:sync",
    "uv",
    "../docs/05-runbooks/operations.md",
  ]);
  expectNoText(target, "3-10-k-parser/README.md", "parser README", ["3306"]);
  addServicePathInfo(target, [
    "curl -s http://127.0.0.1:3406/health",
    "POST /api/langgraph/threads",
    "POST /api/langgraph/threads/{threadId}/runs/stream",
  ]);
  return target;
}

function checkChatbot() {
  const target = createTarget(
    "4-10-k-chat-bot-next",
    "chat UI, CopilotKit adapter, and SEC admin tools",
    "4-10-k-chat-bot-next",
  );
  const pkg = expectPackage(
    target,
    "4-10-k-chat-bot-next/package.json",
    "@10k/chatbot",
  );
  expectScripts(target, pkg, [
    "dev",
    "build",
    "start",
    "lint",
    "format",
    "db:migrate",
    "test:unit",
    "test:e2e",
  ]);
  const env = expectEnvKeys(target, "4-10-k-chat-bot-next/.env.example", [
    "AUTH_SECRET",
    "NEXT_PUBLIC_APP_URL",
    "POSTGRES_URL",
    "COLLECTOR_DATABASE_URL",
    "COLLECTOR_DATA_DIR",
    "PARSER_BACKEND_URL",
  ]);
  expectEnvValue(target, env, "NEXT_PUBLIC_APP_URL", "http://localhost:3003");
  expectEnvValue(target, env, "PARSER_BACKEND_URL", "http://127.0.0.1:3406");
  expectExecutable(
    target,
    "4-10-k-chat-bot-next/scripts/preserve-next-env.sh",
    "restore the Next env snapshot wrapper and run chmod +x",
  );
  expectText(target, "4-10-k-chat-bot-next/scripts/preserve-next-env.sh", "Next env snapshot wrapper", [
    "NEXT_ENV_FILE",
    "trap cleanup EXIT",
    "trap 'exit 130' INT",
  ]);
  expectText(target, "4-10-k-chat-bot-next/package.json", "chatbot package scripts", [
    "scripts/preserve-next-env.sh",
    "next typegen",
    "if [ \\\"${1:-}\\\" = \\\"--\\\" ]; then shift; fi",
    "export PORT=${PORT:-3003}",
    "export CHATBOT_BASE_URL=",
    "export PLAYWRIGHT_SKIP_WEBSERVER=${PLAYWRIGHT_SKIP_WEBSERVER:-true}",
    "\\\"$@\\\"",
  ]);
  expectText(
    target,
    "4-10-k-chat-bot-next/playwright.config.ts",
    "chatbot Playwright port coordination",
    [
      "process.env.CHATBOT_BASE_URL",
      "process.env.PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_SKIP_WEBSERVER",
      "\"3003\"",
      "PORT=${PORT} pnpm dev",
    ],
  );
  expectFile(
    target,
    "4-10-k-chat-bot-next/app/api/copilotkit",
    "restore CopilotKit API route",
  );
  expectFile(
    target,
    "4-10-k-chat-bot-next/lib/investment-assistant",
    "restore investment assistant server model",
  );
  expectFile(
    target,
    "4-10-k-chat-bot-next/lib/sec/api-response.ts",
    "restore structured SEC API response helpers",
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/scripts/sec-api-response-smoke.ts",
    "SEC API response contract smoke",
    [
      "req-bad-request",
      "sec_bad_request",
      "bad request should include parameter recovery",
    ],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/app/admin/sec-playground/page.tsx",
    "SEC playground stale selection prevention",
    [
      "clearLoadedResponses",
      "handleCompanyQueryChange",
      "Company is required.",
    ],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/lib/investment-assistant/graph-rag.ts",
    "chatbot Graph RAG selected filing request",
    ["selectedFiling", "FilingSelectionState"],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/lib/investment-assistant/readiness.ts",
    "chatbot data readiness model",
    [
      "buildInvestmentDataReadiness",
      "Filing catalog",
      "Local filing text",
      "Parser graph",
      "Filing freshness",
      "Data Readiness: Ready",
    ],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/components/investment-data-readiness-card.tsx",
    "chatbot data readiness UI",
    ["Data Readiness", "readiness.summary", "readiness.items"],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/lib/investment-assistant/types.ts",
    "chatbot A2UI surface validation",
    [
      "InvestmentA2UIComponent",
      "InvestmentA2UIRootId = \"root\"",
      "normalizeInvestmentA2UISurface",
    ],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/scripts/investment-assistant-runtime-state-smoke.ts",
    "investment assistant dashboard schema smoke",
    [
      "buildInvestmentDataReadiness",
      "runtime issue should block data readiness",
      "current local filing with graph evidence should be data ready",
      "normalizeInvestmentA2UISurface",
      "dashboard root should be stable",
      "unsupported component should be rejected",
    ],
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/lib/investment-assistant/server.ts",
    "investment assistant graph query scope",
    ["selectedFiling: filing", "normalizeInvestmentA2UISurface"],
  );
  expectNoFile(
    target,
    "4-10-k-chat-bot-next/tsconfig.tsbuildinfo",
    "remove tracked TypeScript build cache and keep tsBuildInfoFile under .next/cache",
  );
  expectNextEnvRouteTypes(target);
  expectText(target, "4-10-k-chat-bot-next/tsconfig.json", "chatbot TypeScript config", [
    ".next/cache/tsconfig.tsbuildinfo",
  ]);
  expectFile(
    target,
    "4-10-k-chat-bot-next/tests/e2e/investment-assistant-inline-panels.test.ts",
    "restore investment assistant e2e coverage",
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/tests/e2e/investment-assistant-inline-panels.test.ts",
    "investment assistant data readiness e2e coverage",
    ["Data Readiness", "Filing catalog", "Local filing text", "Parser graph"],
  );
  expectFile(
    target,
    "4-10-k-chat-bot-next/tests/e2e/sec-api-contract.test.ts",
    "restore SEC API contract e2e coverage",
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/tests/e2e/sec-api-contract.test.ts",
    "SEC API contract e2e coverage",
    [
      "returns structured bad-request problems",
      "sec_bad_request",
      "Invalid request body",
    ],
  );
  expectFile(
    target,
    "4-10-k-chat-bot-next/tests/e2e/sec-playground.test.ts",
    "restore SEC playground e2e coverage",
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/tests/e2e/sec-playground.test.ts",
    "SEC playground e2e coverage",
    [
      "clears stale filing selection",
      "Company is required.",
      "sec_bad_request",
    ],
  );
  expectText(target, "4-10-k-chat-bot-next/README.md", "chatbot README", [
    "http://localhost:3003",
    "PARSER_BACKEND_URL=http://127.0.0.1:3406",
    "../docs/05-runbooks/operations.md",
  ]);
  expectExecutable(
    target,
    "4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh",
    "run chmod +x 4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh",
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh",
    "parser-backed chat smoke",
    ["http://localhost:3003", "mktemp -d", "trap cleanup EXIT"],
  );
  expectNoText(
    target,
    "4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh",
    "parser-backed chat smoke",
    ["http://localhost:3300", "/tmp/e2e-chat-payload-parser.json"],
  );
  expectExecutable(
    target,
    "4-10-k-chat-bot-next/tests/local-sec-chat-fallback-smoke.sh",
    "run chmod +x 4-10-k-chat-bot-next/tests/local-sec-chat-fallback-smoke.sh",
  );
  expectText(
    target,
    "4-10-k-chat-bot-next/tests/local-sec-chat-fallback-smoke.sh",
    "local SEC chat fallback smoke",
    ["http://localhost:3003", "mktemp -d", "trap cleanup EXIT"],
  );
  expectNoText(
    target,
    "4-10-k-chat-bot-next/tests/local-sec-chat-fallback-smoke.sh",
    "local SEC chat fallback smoke",
    ["http://localhost:3300", "/tmp/e2e-chat-payload-smoke.json"],
  );
  addServicePathInfo(target, [
    "curl -s http://127.0.0.1:3003/api/copilotkit/info",
    "GET /api/sec/filings",
    "POST /api/sec/full-text",
  ]);
  return target;
}

function collectStaticResults() {
  return [
    checkHarness(),
    checkInfra(),
    checkCollector(),
    checkParser(),
    checkChatbot(),
  ];
}

function runVerificationCommands() {
  if (!runChecks && !runE2e) {
    return [];
  }

  const commands = [
    {
      command: "node",
      args: ["--check", "scripts/project-doctor.mjs"],
      label: "doctor syntax",
    },
    {
      command: "node",
      args: ["--check", "scripts/test-e2e.mjs"],
      label: "e2e runner syntax",
    },
    {
      command: "node",
      args: ["--check", "scripts/run-doctor-probe.mjs"],
      label: "doctor probe runner syntax",
    },
    {
      command: "git",
      args: ["diff", "--check"],
      label: "whitespace check",
    },
    {
      command: "pnpm",
      args: ["--filter", "@10k/infra", "run", "build"],
      label: "infra compose config",
    },
    {
      command: "pnpm",
      args: ["--filter", "@10k/chatbot", "run", "lint"],
      label: "chatbot lint",
    },
    { command: "pnpm", args: ["run", "build"], label: "workspace build" },
    {
      command: "pnpm",
      args: ["run", "test:unit"],
      label: "workspace unit checks",
    },
  ];

  if (runE2e) {
    commands.push({
      command: "pnpm",
      args: ["run", "test:e2e"],
      label: "workspace e2e",
    });
  }

  const results = [];
  for (const item of commands) {
    if (!outputJson) {
      console.log(`\nRunning ${item.label}: ${item.command} ${item.args.join(" ")}`);
    }

    const result = runCommand(item.command, item.args, item.label);
    results.push(result);

    if (!result.ok && !outputJson) {
      console.error(
        `Command failed: ${result.command} (status ${result.status ?? "null"}, signal ${result.signal ?? "none"})`,
      );
    }
  }

  return results;
}

function summarize(targets, commandResults) {
  const failures = targets.reduce(
    (count, target) => count + target.failures.length,
    0,
  );
  const warnings = targets.reduce(
    (count, target) => count + target.warnings.length,
    0,
  );
  const commandFailures = commandResults.filter((result) => !result.ok).length;

  return {
    status: failures + commandFailures === 0 ? "pass" : "fail",
    targets: targets.length,
    failures,
    warnings,
    commandFailures,
    runChecks,
    runE2e,
    probeServices,
  };
}

function printResults(targets, commandResults, summary) {
  console.log("Project Doctor");
  console.log("==============");
  console.log(
    `Mode: static${probeServices ? " + service probes" : ""}${runChecks ? " + verification checks" : ""}${runE2e ? " + e2e" : ""}`,
  );
  console.log(
    `Summary: ${summary.status.toUpperCase()} (${summary.failures} failures, ${summary.warnings} warnings, ${summary.commandFailures} command failures)`,
  );

  for (const target of targets) {
    const status = target.failures.length === 0 ? "PASS" : "FAIL";
    console.log(`\n[${status}] ${target.id} - ${target.label}`);
    console.log(`  Directory: ${target.directory}`);

    for (const check of target.checks) {
      console.log(`  + ${check}`);
    }
    for (const warning of target.warnings) {
      console.log(`  ! ${warning}`);
    }
    for (const failure of target.failures) {
      console.log(`  x ${failure}`);
    }
    for (const item of target.info) {
      console.log(`  - ${item}`);
    }
  }

  if (commandResults.length > 0) {
    console.log("\nVerification Commands");
    for (const result of commandResults) {
      const status = result.ok ? "PASS" : "FAIL";
      console.log(
        `[${status}] ${result.label}: ${result.command} (${result.durationMs}ms)`,
      );
    }
  } else {
    console.log("\nNext verification:");
    console.log("  pnpm run doctor:verify");
    console.log("  pnpm run doctor:e2e");
  }
}

const targets = collectStaticResults();
await maybeProbeServices(targets);
const commandResults = runVerificationCommands();
const summary = summarize(targets, commandResults);

if (outputJson) {
  console.log(JSON.stringify({ summary, targets, commandResults }, null, 2));
} else {
  printResults(targets, commandResults, summary);
}

process.exit(summary.status === "pass" ? 0 : 1);

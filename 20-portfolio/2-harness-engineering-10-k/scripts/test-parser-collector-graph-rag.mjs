import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const collectorRoot = fileURLToPath(
  new URL("../2-10-k-collector/", import.meta.url),
);
const parserRoot = fileURLToPath(new URL("../3-10-k-parser/", import.meta.url));

const collectorBaseUrlRaw =
  process.env.COLLECTOR_API_BASE_URL || "http://127.0.0.1:3305";
const collectorBaseUrl = collectorBaseUrlRaw.replace(/\/$/, "");
const collectorApiBaseUrl = collectorBaseUrl.endsWith("/api")
  ? collectorBaseUrl
  : `${collectorBaseUrl}/api`;
const parserBaseUrl =
  process.env.PARSER_BACKEND_URL || "http://127.0.0.1:3406";
const ticker = (process.env.GRAPH_RAG_SMOKE_TICKER || "AAPL").toUpperCase();
const since = process.env.GRAPH_RAG_SMOKE_SINCE || "2025-01-01";
const requestIdPrefix = `graph-rag-smoke-${Date.now().toString(36)}`;
const services = [];

const sharedEnv = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:55432/sec_collector",
  COLLECTOR_API_BASE_URL: collectorBaseUrl,
  LLM_PROVIDER: process.env.LLM_PROVIDER || "mock",
  NEO4J_URI: process.env.NEO4J_URI || "bolt://127.0.0.1:7687",
  NEO4J_USER: process.env.NEO4J_USER || "neo4j",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "test1234",
  NEO4J_DATABASE: process.env.NEO4J_DATABASE || "neo4j",
  SEC_USER_AGENT:
    process.env.SEC_USER_AGENT ||
    "harness-engineering-10-k graph-rag-smoke contact@example.com",
};

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...sharedEnv },
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

function spawnService(name, cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...sharedEnv },
    ...options,
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

async function requestJson(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${collectorApiBaseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-request-id": `${requestIdPrefix}-request`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed: ${response.status} ${text}`);
  }

  return body;
}

async function waitForHttp(url, timeoutMs = 120_000) {
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

async function retry(label, fn, timeoutMs = 120_000) {
  const startedAt = Date.now();
  let lastError = "unknown";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(1_000);
    }
  }

  throw new Error(`Timed out during ${label}: ${lastError}`);
}

async function waitForNeo4jBolt() {
  await retry("neo4j bolt readiness", () =>
    run(
      "docker",
      [
        "exec",
        "graph-rag-neo4j",
        "cypher-shell",
        "-u",
        sharedEnv.NEO4J_USER,
        "-p",
        sharedEnv.NEO4J_PASSWORD,
        "RETURN 1;",
      ],
      { stdio: "ignore" },
    ),
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEvidenceText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function assertEvidenceQuality(evidence, selectedFiling) {
  const seenEvidence = new Set();
  const allowedNodeTypes = new Set(["Risk", "Metric", "SectionText"]);

  for (const [index, item] of evidence.entries()) {
    const label = `Graph RAG evidence[${index}]`;
    const text = normalizeEvidenceText(item.text);

    assert(isNonEmptyString(item.citationLabel), `${label} is missing citationLabel`);
    assert(
      /^Item [0-9A-Z?]+$/.test(item.citationLabel),
      `${label} citationLabel is not item-based: ${item.citationLabel}`,
    );
    assert(isNonEmptyString(item.nodeType), `${label} is missing nodeType`);
    assert(
      allowedNodeTypes.has(item.nodeType),
      `${label} has unexpected nodeType: ${item.nodeType}`,
    );
    assert(isNonEmptyString(item.itemCode), `${label} is missing itemCode`);
    assert(isNonEmptyString(text) && text.length >= 40, `${label} text is too short`);
    assert(!/<[^>]+>/.test(text), `${label} text still contains HTML tags`);
    assert(
      typeof item.score === "number" && Number.isFinite(item.score) && item.score > 0,
      `${label} score is not a positive finite number`,
    );
    assert(isNonEmptyString(item.reason), `${label} is missing retrieval reason`);
    assert(
      isNonEmptyString(item.filingId) && item.filingId === selectedFiling.filingId,
      `${label} filingId does not match selected filing ${selectedFiling.filingId}`,
    );
    assert(isNonEmptyString(item.companyName), `${label} is missing companyName`);

    const dedupeKey = [
      item.filingId,
      item.itemCode,
      item.nodeType,
      item.citationLabel,
      text,
    ].join("|");
    assert(!seenEvidence.has(dedupeKey), `${label} duplicates an earlier evidence item`);
    seenEvidence.add(dedupeKey);
  }
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

  await run("pnpm", ["run", "infra:down"]).catch(() => {});
}

async function seedCollectorData() {
  await requestJson("/company-sync-jobs", {
    method: "POST",
    body: JSON.stringify({}),
  });
  await requestJson("/filing-sync-jobs", {
    method: "POST",
    body: JSON.stringify({ tickers: [ticker], since }),
  });
  await requestJson("/filing-download-jobs", {
    method: "POST",
    body: JSON.stringify({ tickers: [ticker], since, maxFiles: 1 }),
  });

  const downloaded = await requestJson(
    `/filings/downloaded-reports?${new URLSearchParams({
      ticker,
      since,
      pageSize: "5",
    })}`,
  );
  assert(
    Array.isArray(downloaded.items) && downloaded.items.length > 0,
    `No downloaded ${ticker} filing was available after collector seed`,
  );

  const target = downloaded.items[0];
  await requestJson("/filings/parser-status", {
    method: "POST",
    body: JSON.stringify({
      cik: target.cik,
      accessionNo: target.accessionNo,
      parserStatus: "",
    }),
  });

  return target;
}

async function createParseJob() {
  const created = await requestJson(`${parserBaseUrl}/api/parser/collector/parse-jobs`, {
    method: "POST",
    headers: { "x-request-id": `${requestIdPrefix}-parse` },
    body: JSON.stringify({
      ticker,
      since,
      pageSize: 1,
      parserStatus: "",
      dry_run: false,
      include_debug: false,
      parserStatusOnSuccess: "parsed",
      parserStatusOnFailure: "parse_failed",
    }),
  });

  assert(created.jobId, "Parser collector parse job did not return jobId");
  return created.jobId;
}

async function waitForParseJob(jobId) {
  for (let attempt = 1; attempt <= 120; attempt += 1) {
    await sleep(1_000);
    const job = await requestJson(`${parserBaseUrl}/api/parser/collector/parse-jobs/${jobId}`, {
      headers: { "x-request-id": `${requestIdPrefix}-parse` },
    });

    if (!["completed", "completed_with_errors", "failed"].includes(job.status)) {
      continue;
    }

    assert(job.status === "completed", `Parser job ended with status=${job.status}`);
    assert(job.success >= 1, `Parser job did not parse any filing: success=${job.success}`);
    assert(job.failed === 0, `Parser job reported failures: failed=${job.failed}`);
    assert(
      Array.isArray(job.results) &&
        job.results.some((result) => result.written_nodes > 0 && result.written_relationships > 0),
      "Parser job did not write graph nodes and relationships",
    );
    assert(
      job.collectorRequestIdMatched === true,
      "Parser job did not preserve collector request correlation",
    );

    return job;
  }

  throw new Error(`Parser job did not finish before timeout: ${jobId}`);
}

async function queryGraphRag(accessionNo) {
  const response = await requestJson(`${parserBaseUrl}/api/graph-rag/query`, {
    method: "POST",
    body: JSON.stringify({
      ticker,
      accessionNo,
      query: `${ticker} risk factors and business highlights`,
      evidenceLimit: 4,
    }),
  });

  const evidence = response.evidenceBundle || [];
  assert(Array.isArray(evidence) && evidence.length > 0, "Graph RAG returned no evidence");
  assert(evidence.length <= 4, `Graph RAG ignored evidenceLimit=4: ${evidence.length}`);
  assert(isNonEmptyString(response.intent), "Graph RAG response did not include intent");
  assert(isNonEmptyString(response.answer), "Graph RAG response did not include answer text");
  assert(
    response.answer.includes("Focus:") && response.answer.includes("[Item "),
    "Graph RAG answer did not include focus and citation-backed snippets",
  );
  assert(
    response.selectedFiling?.ticker === ticker,
    `Graph RAG selected unexpected ticker: ${response.selectedFiling?.ticker ?? "none"}`,
  );
  assert(
    response.selectedFiling?.accessionNo === accessionNo,
    `Graph RAG selected unexpected accessionNo: ${response.selectedFiling?.accessionNo ?? "none"}`,
  );
  assert(
    response.selectedFiling?.filingId,
    "Graph RAG selected filing did not include filingId",
  );
  assert(
    evidence.every((item) => item.filingId === response.selectedFiling.filingId),
    `Graph RAG returned evidence outside selected filing ${response.selectedFiling.filingId}`,
  );
  assertEvidenceQuality(evidence, response.selectedFiling);

  return response;
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
    await waitForNeo4jBolt();
    await killListeningPort(3305);
    await killListeningPort(3406);

    spawnService("collector", "./node_modules/.bin/tsx", ["src/main.ts"], {
      cwd: collectorRoot,
    });
    spawnService(
      "parser",
      "sh",
      [
        "-lc",
        'UV_BIN=$(sh ../scripts/ensure-uv.sh) && "$UV_BIN" sync --project . && exec "$UV_BIN" run --project . python -m parser.server --host "${APP_HOST:-0.0.0.0}" --port "${APP_PORT:-3406}"',
      ],
      { cwd: parserRoot },
    );

    await Promise.all([
      waitForHttp(`${collectorApiBaseUrl}/filings?limit=1`),
      waitForHttp(`${parserBaseUrl}/health`),
    ]);
    await retry("init neo4j", () =>
      requestJson(`${parserBaseUrl}/api/parser/init-neo4j`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    await waitForNeo4jBolt();

    const target = await seedCollectorData();
    const jobId = await createParseJob();
    const job = await waitForParseJob(jobId);
    const parsedAccessionNo =
      job.results.find((result) => result.collector?.accessionNo)?.collector
        ?.accessionNo || target.accessionNo;
    const graph = await queryGraphRag(parsedAccessionNo);

    console.log(
      JSON.stringify(
        {
          smoke: "parser-collector-graph-rag",
          ticker,
          since,
          target: {
            accessionNo: target.accessionNo,
            formType: target.formType,
            filingDate: target.filingDate,
          },
          jobId,
          success: job.success,
          writtenNodes: job.results.reduce(
            (sum, result) => sum + Number(result.written_nodes || 0),
            0,
          ),
          writtenRelationships: job.results.reduce(
            (sum, result) => sum + Number(result.written_relationships || 0),
            0,
          ),
          evidenceCount: graph.evidenceBundle.length,
          selectedFiling: graph.selectedFiling,
          evidencePreview: graph.evidenceBundle.map((item) => ({
            citationLabel: item.citationLabel,
            nodeType: item.nodeType,
            itemCode: item.itemCode,
            score: item.score,
            textLength: normalizeEvidenceText(item.text).length,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
  }
}

await main();

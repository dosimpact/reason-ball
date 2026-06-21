const crypto = require("crypto");
const http = require("http");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const client = require("prom-client");
const { WebSocketServer } = require("ws");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 2929);
const JWT_SECRET = process.env.JWT_SECRET || "local-artillery-secret";

const app = express();
const server = http.createServer(app);

const items = Array.from({ length: 25 }, (_, index) => ({
  id: crypto.randomUUID(),
  title: `seed-item-${index + 1}`,
  description: "Initial sample item",
  createdAt: new Date().toISOString(),
}));

client.collectDefaultMetrics();

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };

    httpRequests.inc(labels);
    httpDuration.observe(labels, durationSeconds);
  });

  next();
});

morgan.token("request-id", (req) => req.requestId);
morgan.token("load-test-run-id", (req) => req.get("x-load-test-run-id") || "-");
app.use(
  morgan(
    "request_id=:request-id load_test_run_id=:load-test-run-id method=:method url=:url status=:status response_time_ms=:response-time"
  )
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function burnCpu(ms) {
  const end = Date.now() + ms;
  let value = 0;
  while (Date.now() < end) {
    value += Math.sqrt(Math.random() * 1000);
  }
  return value;
}

function authenticate(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return res.status(401).json({ error: "missing bearer token" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "invalid token" });
  }
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    requestId: req.requestId,
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  await sleep(20);

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const accessToken = jwt.sign({ sub: email, role: "load-tester" }, JWT_SECRET, {
    expiresIn: "30m",
  });

  return res.json({ accessToken, tokenType: "Bearer" });
});

app.get("/api/items", authenticate, async (req, res) => {
  await sleep(Number(req.query.delayMs || 30));
  res.json({
    items: items.slice(-50),
    count: items.length,
  });
});

app.post("/api/items", authenticate, async (req, res) => {
  const { title, description } = req.body || {};

  await sleep(40);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  const item = {
    id: crypto.randomUUID(),
    title,
    description: description || "",
    createdBy: req.user.sub,
    createdAt: new Date().toISOString(),
  };

  items.push(item);
  return res.status(201).json(item);
});

app.get("/api/slow", authenticate, async (req, res) => {
  const delayMs = Math.min(Number(req.query.delayMs || 500), 5000);
  await sleep(delayMs);
  res.json({ delayMs });
});

app.get("/api/cpu", authenticate, (req, res) => {
  const ms = Math.min(Number(req.query.ms || 80), 2000);
  const value = burnCpu(ms);
  res.json({ burnedMs: ms, value });
});

app.get("/api/flaky", authenticate, (req, res) => {
  const failureRate = Math.min(Number(req.query.failureRate || 0.05), 1);

  if (Math.random() < failureRate) {
    return res.status(503).json({ error: "intentional flaky response" });
  }

  return res.json({ status: "ok", failureRate });
});

app.get("/metrics", async (req, res) => {
  res.set("content-type", client.register.contentType);
  res.end(await client.register.metrics());
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    socket.send(
      JSON.stringify({
        type: "echo",
        received: message.toString(),
        at: new Date().toISOString(),
      })
    );
  });

  socket.send(JSON.stringify({ type: "connected" }));
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  socket.on("join", (payload, ack) => {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    socket.join(data?.roomId || "default");
    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("message", (payload, ack) => {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    io.to(data?.roomId || "default").emit("message:received", {
      ...data,
      receivedAt: new Date().toISOString(),
    });
    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Artillery target server listening on http://localhost:${PORT}`);
});

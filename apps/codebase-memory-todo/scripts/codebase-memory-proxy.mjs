import http from "node:http";
import net from "node:net";

const proxyHost = process.env.CODEBASE_MEMORY_PROXY_HOST ?? "0.0.0.0";
const proxyPort = parsePort(process.env.CODEBASE_MEMORY_PROXY_PORT, 3000);
const uiHost = process.env.CODEBASE_MEMORY_UI_HOST ?? "127.0.0.1";
const uiPort = parsePort(process.env.CODEBASE_MEMORY_UI_PORT, 3001);
const uiOrigin = `http://${uiHost}:${uiPort}`;

function parsePort(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

function rewriteReferer(value) {
  try {
    const referer = new URL(value);
    return `${uiOrigin}${referer.pathname}${referer.search}`;
  } catch {
    return `${uiOrigin}/`;
  }
}

function rewriteHeaders(requestHeaders) {
  const headers = {
    ...requestHeaders,
    host: `${uiHost}:${uiPort}`,
  };

  if (headers.origin) {
    headers.origin = uiOrigin;
  }

  if (headers.referer) {
    headers.referer = rewriteReferer(headers.referer);
  }

  if (headers["sec-websocket-origin"]) {
    headers["sec-websocket-origin"] = uiOrigin;
  }

  return headers;
}

function writeHeaders(socket, headers) {
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        socket.write(`${name}: ${item}\r\n`);
      }
    } else if (value !== undefined) {
      socket.write(`${name}: ${value}\r\n`);
    }
  }
}

const server = http.createServer((request, response) => {
  const upstreamRequest = http.request(
    {
      hostname: uiHost,
      port: uiPort,
      path: request.url,
      method: request.method,
      headers: rewriteHeaders(request.headers),
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on("error", (error) => {
    console.error(`HTTP upstream error: ${error.message}`);

    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }

    response.end("Codebase Memory UI is unavailable.\n");
  });

  request.pipe(upstreamRequest);
});

server.on("upgrade", (request, clientSocket, head) => {
  const upstreamSocket = net.connect(uiPort, uiHost, () => {
    clientSocket.pause();
    upstreamSocket.write(
      `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`,
    );
    writeHeaders(upstreamSocket, rewriteHeaders(request.headers));
    upstreamSocket.write("\r\n");

    if (head.length > 0) {
      upstreamSocket.write(head);
    }

    clientSocket.pipe(upstreamSocket);
    upstreamSocket.pipe(clientSocket);
    clientSocket.resume();
  });

  const closeSockets = () => {
    clientSocket.destroy();
    upstreamSocket.destroy();
  };

  clientSocket.on("error", closeSockets);
  upstreamSocket.on("error", closeSockets);
});

server.on("error", (error) => {
  console.error(`Proxy server error: ${error.message}`);
  process.exitCode = 1;
});

function shutdown(signal) {
  console.log(`Received ${signal}; stopping proxy.`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(proxyPort, proxyHost, () => {
  console.log(
    `Codebase Memory proxy: http://${proxyHost}:${proxyPort} -> ${uiOrigin}`,
  );
  console.warn("Warning: this proxy does not provide authentication.");
});

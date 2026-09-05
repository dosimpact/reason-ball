#!/usr/bin/env node
// @ts-nocheck
'use strict';

const { createServer } = require('./src/server');

const server = createServer();
let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;

  let newlineIdx;
  while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);
    if (!line) continue;

    let request;
    try {
      request = JSON.parse(line);
    } catch (err) {
      console.error(`[pgv-state-mcp] JSON parse error: ${err.message}`);
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error', data: err.message }
      }) + '\n');
      continue;
    }

    server.handleRequest(request).then((response) => {
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }).catch((err) => {
      console.error(`[pgv-state-mcp] Error handling request: ${err.message}`);
      if (request.id !== undefined) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32603, message: 'Internal error', data: err.message }
        }) + '\n');
      }
    });
  }
});

process.stdin.on('end', () => {
  console.error('[pgv-state-mcp] stdin closed, shutting down');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error(`[pgv-state-mcp] Uncaught exception: ${err.message}`);
  process.exit(1);
});

console.error('[pgv-state-mcp] PGV state MCP server started (STDIO)');

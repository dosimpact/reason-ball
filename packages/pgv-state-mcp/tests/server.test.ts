// @ts-nocheck
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');

describe('pgv-state-mcp server', () => {
  it('responds to initialize', async () => {
    const server = createServer();
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    assert.strictEqual(response.jsonrpc, '2.0');
    assert.strictEqual(response.id, 1);
    assert.strictEqual(response.result.serverInfo.name, 'pgv-state-mcp');
    assert.ok(response.result.capabilities.tools);
  });

  it('lists PGV state tools', async () => {
    const server = createServer();
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    const names = response.result.tools.map((tool) => tool.name);
    assert.deepStrictEqual(names, [
      'pgv_state_init',
      'pgv_state_get_status',
      'pgv_state_pgv_plan',
      'pgv_state_pgv_gradate',
      'pgv_state_pgv_validate',
      'pgv_state_pgv_archive'
    ]);
  });

  it('returns an MCP tool error for unknown tools', async () => {
    const server = createServer();
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'unknown_tool',
        arguments: {}
      }
    });

    assert.strictEqual(response.result.isError, true);
    assert.match(response.result.content[0].text, /Unknown tool/);
  });
});

export {};

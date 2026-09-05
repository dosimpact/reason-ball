// @ts-nocheck
'use strict';

const { getToolDefinitions, executeToolCall } = require('./tools');

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'pgv-state-mcp';
const SERVER_VERSION = '0.1.0';

function createServer() {
  const state = {
    initialized: false,
    projectDir: null
  };

  async function handleRequest(request) {
    const { method, params, id } = request;

    if (id === undefined) {
      if (method === 'notifications/initialized') {
        state.initialized = true;
        console.error('[pgv-state-mcp] Client initialized');
      }
      return null;
    }

    try {
      const result = await dispatch(method, params || {});
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: err.code || -32603,
          message: err.message || 'Internal error'
        }
      };
    }
  }

  async function dispatch(method, params) {
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} }
        };
      case 'tools/list':
        return { tools: getToolDefinitions() };
      case 'tools/call':
        return handleToolsCall(params);
      default: {
        const err = new Error(`Method not found: ${method}`);
        err.code = -32601;
        throw err;
      }
    }
  }

  async function handleToolsCall(params) {
    const { name, arguments: args } = params;
    if (!name) {
      const err = new Error('Missing tool name');
      err.code = -32602;
      throw err;
    }

    try {
      const result = await executeToolCall(name, args || {}, state);
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true
      };
    }
  }

  return { handleRequest, state };
}

module.exports = { createServer };

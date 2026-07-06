// @ts-nocheck
'use strict';

const tools = {
  pgv_state_init: require('./init'),
  pgv_state_get_status: require('./get-status'),
  pgv_state_pgv_plan: require('./pgv-plan'),
  pgv_state_pgv_gradate: require('./pgv-gradate'),
  pgv_state_pgv_validate: require('./pgv-validate')
};

function getToolDefinitions() {
  return Object.values(tools).map((tool) => tool.definition);
}

async function executeToolCall(name, args, context) {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(args, context);
}

module.exports = { getToolDefinitions, executeToolCall };

export {};

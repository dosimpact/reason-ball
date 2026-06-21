// @ts-nocheck
'use strict';

const tools = {
  ckit_init: require('./init'),
  ckit_get_status: require('./get-status'),
  ckit_pre_write_check: require('./pre-write'),
  ckit_post_write: require('./post-write'),
  ckit_complete_phase: require('./complete'),
  ckit_pdca_plan: require('./pdca-plan'),
  ckit_pdca_design: require('./pdca-design'),
  ckit_pdca_analyze: require('./pdca-analyze'),
  ckit_pdca_next: require('./pdca-next'),
  ckit_analyze_prompt: require('./analyze-prompt'),
  ckit_select_template: require('./template'),
  ckit_memory_read: require('./memory-read'),
  ckit_memory_write: require('./memory-write')
};

/**
 * Get all tool definitions for tools/list response.
 * @returns {object[]}
 */
function getToolDefinitions() {
  return Object.values(tools).map(t => t.definition);
}

/**
 * Execute a tool by name.
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {object} context - Server state (projectDir, etc.)
 * @returns {Promise<object>}
 */
async function executeToolCall(name, args, context) {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(args, context);
}

module.exports = { getToolDefinitions, executeToolCall };

export {};

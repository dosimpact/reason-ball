// @ts-nocheck
'use strict';

const { initializeWorkspace, STATUS_FILE } = require('../lib/state');

async function handler(args, context) {
  const projectDir = args.projectDir;
  if (!projectDir) {
    return { error: 'projectDir is required' };
  }

  context.projectDir = projectDir;
  const result = await initializeWorkspace(projectDir);

  return {
    initialized: true,
    created: !result.existed,
    projectDir,
    statusFile: STATUS_FILE,
    status: result.status
  };
}

const definition = {
  name: 'pgv_state_init',
  description: 'Initialize PGV state workspace under .apb-workspace/docs for the current project.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the project root directory.'
      }
    },
    required: ['projectDir']
  }
};

module.exports = { handler, definition };

export {};

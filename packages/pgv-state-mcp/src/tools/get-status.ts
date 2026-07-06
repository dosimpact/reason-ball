// @ts-nocheck
'use strict';

const { fileExists } = require('../lib/files');
const { getPhaseProgress, getStatusPath, readStatus, STATUS_FILE } = require('../lib/state');

async function handler(args, context) {
  const projectDir = args.projectDir || context.projectDir;
  if (!projectDir) {
    return {
      exists: false,
      error: 'Session not initialized. Call pgv_state_init with projectDir first, or pass projectDir.'
    };
  }

  context.projectDir = projectDir;
  const statusPath = getStatusPath(projectDir);
  const exists = await fileExists(statusPath);
  if (!exists) {
    return {
      exists: false,
      statusFile: STATUS_FILE,
      suggestion: 'Call pgv_state_init with the current projectDir.'
    };
  }

  const status = await readStatus(projectDir);
  const feature = args.feature;
  if (feature) {
    const featureStatus = status.features[feature] || null;
    return {
      exists: true,
      feature,
      found: Boolean(featureStatus),
      status: featureStatus,
      progress: getPhaseProgress(featureStatus),
      documents: featureStatus ? featureStatus.documents : {}
    };
  }

  return {
    exists: true,
    activeFeatures: status.activeFeatures,
    primaryFeature: status.primaryFeature,
    features: status.features,
    statusFile: STATUS_FILE,
    lastUpdated: status.lastUpdated
  };
}

const definition = {
  name: 'pgv_state_get_status',
  description: 'Get current PGV status for the project or a specific feature.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the project root directory. Optional after init.'
      },
      feature: {
        type: 'string',
        description: 'Feature name. If omitted, returns all tracked features.'
      }
    }
  }
};

module.exports = { handler, definition };

export {};

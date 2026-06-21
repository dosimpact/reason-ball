// @ts-nocheck
'use strict';

const { readPdcaStatus, getCompactSummary } = require('../lib/pdca/status');
const { loadConfig } = require('../lib/core/config');
const { generatePdcaGuidance } = require('../lib/pdca/automation');
const { setCache } = require('../lib/core/cache');

/**
 * ckit_init - Initialize ckit session.
 * Reads PDCA status and returns session context.
 */
async function handler(args, context) {
  const projectDir = args.projectDir;
  if (!projectDir) {
    return { error: 'projectDir is required' };
  }

  // Set project dir in server context
  context.projectDir = projectDir;

  // Load config
  await loadConfig(projectDir);

  // Read PDCA status
  const pdcaStatus = await readPdcaStatus(projectDir);
  pdcaStatus.session.startedAt = new Date().toISOString();
  pdcaStatus.session.lastActivity = new Date().toISOString();

  // Fix platform field (FR-11)
  pdcaStatus.session.platform = 'codex';

  // Generate guidance
  let guidance = 'Project initialized.';
  const primaryFeature = pdcaStatus.primaryFeature;
  if (primaryFeature) {
    guidance = await generatePdcaGuidance(projectDir, primaryFeature);
  } else if (pdcaStatus.activeFeatures.length === 0) {
    guidance += ' No active PDCA features. Start with: $pdca plan <feature-name>';
  }

  const sessionId = `ckit-${Date.now()}`;

  // Compact summary for compaction resilience (C-3)
  const compactSummary = getCompactSummary(pdcaStatus);

  const result = {
    pdcaStatus: {
      activeFeatures: pdcaStatus.activeFeatures,
      primaryFeature: pdcaStatus.primaryFeature,
      features: pdcaStatus.features
    },
    compactSummary,
    contextRecoveryHint: 'If context seems incomplete, call ckit_get_status with mode: "recovery".',
    sessionId,
    guidance
  };

  // Cache the result
  setCache('init', result, 5000);
  setCache('projectDir', projectDir, 300000);

  return result;
}

const definition = {
  name: 'ckit_init',
  description: 'Initialize ckit session. Call at the start of each session. Reads PDCA status and returns session context.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the project root directory'
      }
    },
    required: ['projectDir']
  }
};

module.exports = { handler, definition };

export {};

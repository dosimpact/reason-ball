// @ts-nocheck
'use strict';

const { checkDesignExists, classifyTask } = require('../lib/pdca/automation');
const { readPdcaStatus } = require('../lib/pdca/status');
const { extractFeatureName } = require('../lib/core/feature');

/**
 * ckit_post_write - Post-write guidance.
 */
async function handler(args, context) {
  const projectDir = context.projectDir;
  if (!projectDir) {
    return { error: 'Session not initialized. Call ckit_init first.' };
  }

  const filePath = args.filePath;
  if (!filePath) {
    return { error: 'filePath is required' };
  }

  const linesChanged = args.linesChanged || 0;

  // Extract or use provided feature
  let feature = args.feature;
  if (!feature) {
    feature = extractFeatureName(filePath, projectDir);
  }

  // Check for design document
  const hasDesign = feature ? await checkDesignExists(projectDir, feature) : false;

  // Classify the change
  const classification = classifyTask(linesChanged);

  // Determine if gap analysis should be suggested
  const suggestGapAnalysis = hasDesign && (
    classification.classification === 'feature' ||
    classification.classification === 'major_feature' ||
    linesChanged >= 50
  );

  // Build guidance
  const nextSteps = [];
  let guidance = '';

  if (suggestGapAnalysis) {
    guidance = `Significant changes detected (${linesChanged} lines). Consider running gap analysis: $pdca analyze ${feature}`;
    nextSteps.push('Run gap analysis when ready');
  } else if (hasDesign) {
    guidance = `Changes applied. Design document available at docs/02-design/features/${feature}.design.md`;
    nextSteps.push('Continue implementation');
  } else if (feature) {
    guidance = `Changes applied to ${feature}. No design document found.`;
    nextSteps.push('Consider creating a design document');
  } else {
    guidance = 'Changes applied.';
  }

  if (linesChanged >= 200) {
    guidance += ' Major change detected. Gap analysis is strongly recommended.';
    nextSteps.push('Consider splitting large changes into smaller features');
  }

  // Check current PDCA phase
  const status = await readPdcaStatus(projectDir);
  const featureStatus = feature ? status.features[feature] : null;
  if (featureStatus && featureStatus.phase === 'do') {
    nextSteps.push('Complete remaining implementation');
    nextSteps.push('Run gap analysis when implementation is complete');
  }

  return {
    feature: feature || null,
    filePath,
    linesChanged,
    taskClassification: classification.classification,
    hasDesign,
    suggestGapAnalysis,
    guidance,
    nextSteps
  };
}

const definition = {
  name: 'ckit_post_write',
  description: 'Provide guidance after code changes. Suggests gap analysis and reports next steps.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path of the file that was modified'
      },
      linesChanged: {
        type: 'number',
        description: 'Number of lines changed'
      },
      feature: {
        type: 'string',
        description: 'Feature name if known'
      }
    },
    required: ['filePath']
  }
};

module.exports = { handler, definition };

export {};

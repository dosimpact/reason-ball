// @ts-nocheck
'use strict';

const { selectTemplate, getTemplateContent, resolveTemplateVariables } = require('../lib/pdca/template');
const { addFeature, readPdcaStatus, writePdcaStatus } = require('../lib/pdca/status');
const { createTaskChain } = require('../lib/task/creator');

/**
 * ckit_pdca_plan - Generate plan document template.
 */
async function handler(args, context) {
  const projectDir = context.projectDir;
  if (!projectDir) {
    return { error: 'Session not initialized. Call ckit_init first.' };
  }

  const feature = args.feature;
  if (!feature) return { error: 'feature is required' };

  // Select and resolve template
  const templateName = selectTemplate('plan');
  const templateContent = getTemplateContent(templateName);
  const resolved = resolveTemplateVariables(templateContent, {
    FEATURE: feature,
    DATE: new Date().toISOString().split('T')[0]
  });

  // Register feature in PDCA status
  await addFeature(projectDir, feature, 'plan');

  // Create task chain and persist to status (C-4)
  const chain = createTaskChain(feature);
  const status = await readPdcaStatus(projectDir);
  if (status.features[feature] && !status.features[feature].taskChain) {
    status.features[feature].taskChain = chain.tasks.map(t => ({
      phase: t.phase,
      status: t.status,
      createdAt: t.createdAt
    }));
    status.features[feature].timestamps = {
      started: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    await writePdcaStatus(projectDir, status);
  }

  const outputPath = `docs/01-plan/features/${feature}.plan.md`;

  return {
    template: resolved,
    outputPath,
    phase: 'plan',
    guidance: `Fill in the template sections. When complete, call ckit_complete_phase('${feature}', 'plan').`,
    taskChain: {
      created: true,
      tasks: chain.tasks,
      guidance: chain.guidance
    }
  };
}

const definition = {
  name: 'ckit_pdca_plan',
  description: 'Generate a plan document template for a feature. Returns template content to write to docs/01-plan/features/{feature}.plan.md',
  inputSchema: {
    type: 'object',
    properties: {
      feature: {
        type: 'string',
        description: 'Feature name in kebab-case'
      }
    },
    required: ['feature']
  }
};

module.exports = { handler, definition };

export {};

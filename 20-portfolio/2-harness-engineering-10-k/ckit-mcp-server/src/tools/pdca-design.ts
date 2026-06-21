// @ts-nocheck
'use strict';

const { selectTemplate, getTemplateContent, resolveTemplateVariables } = require('../lib/pdca/template');
const { checkPlanExists } = require('../lib/pdca/automation');
const { setFeaturePhase, readPdcaStatus } = require('../lib/pdca/status');

/**
 * ckit_pdca_design - Generate design document template.
 */
async function handler(args, context) {
  const projectDir = context.projectDir;
  if (!projectDir) {
    return { error: 'Session not initialized. Call ckit_init first.' };
  }

  const feature = args.feature;
  if (!feature) return { error: 'feature is required' };

  // Check plan exists (prerequisite)
  const hasPlan = await checkPlanExists(projectDir, feature);
  if (!hasPlan) {
    return {
      error: `Plan document not found for '${feature}'.`,
      guidance: `Create plan first: $pdca plan ${feature}`,
      planPath: `docs/01-plan/features/${feature}.plan.md`
    };
  }

  // Select and resolve template
  const templateName = selectTemplate('design');
  const templateContent = getTemplateContent(templateName);
  const resolved = resolveTemplateVariables(templateContent, {
    FEATURE: feature,
    DATE: new Date().toISOString().split('T')[0]
  });

  // Update PDCA status to design phase
  const status = await readPdcaStatus(projectDir);
  if (status.features[feature]) {
    await setFeaturePhase(projectDir, feature, 'design');
  }

  const outputPath = `docs/02-design/features/${feature}.design.md`;

  return {
    template: resolved,
    outputPath,
    phase: 'design',
    templateName,
    planReference: `docs/01-plan/features/${feature}.plan.md`,
    guidance: `Reference plan document for requirements. Fill in architecture, data model, and API sections. When complete, call ckit_complete_phase('${feature}', 'design').`
  };
}

const definition = {
  name: 'ckit_pdca_design',
  description: 'Generate a design document template. Requires plan document to exist. Returns template content.',
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

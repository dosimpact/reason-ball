// @ts-nocheck
'use strict';

const path = require('path');
const { fileExists, writeTextFile } = require('../lib/files');
const { ensureFeature, initializeWorkspace, readStatus, relativeDocPath, setFeatureDocument } = require('../lib/state');
const { planTemplate } = require('../lib/templates');

async function handler(args, context) {
  const projectDir = args.projectDir || context.projectDir;
  const feature = args.feature;
  if (!projectDir) return { error: 'projectDir is required. Call pgv_state_init first or pass projectDir.' };
  if (!feature) return { error: 'feature is required' };

  context.projectDir = projectDir;
  await initializeWorkspace(projectDir);

  const status = await readStatus(projectDir);
  const existing = status.features[feature] || null;
  const docPath = relativeDocPath('plan', feature);
  const absoluteDocPath = path.join(projectDir, docPath);

  if (existing && existing.status != null && await fileExists(absoluteDocPath)) {
    return {
      feature,
      phase: existing.phase,
      created: false,
      document: docPath,
      message: `Feature '${feature}' already exists; plan was not overwritten.`
    };
  }

  await writeTextFile(absoluteDocPath, planTemplate(feature), { overwrite: false });
  await ensureFeature(projectDir, feature, 'plan');
  await setFeatureDocument(projectDir, feature, 'plan', docPath);

  return {
    feature,
    phase: 'plan',
    created: true,
    document: docPath,
    nextCommand: `apb-pgv plan-gradate ${feature}`
  };
}

const definition = {
  name: 'pgv_state_pgv_plan',
  description: 'Create or resume a PGV plan document for a feature and update PGV state.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the project root directory. Optional after init.'
      },
      feature: {
        type: 'string',
        description: 'Feature name, preferably kebab-case.'
      }
    },
    required: ['feature']
  }
};

module.exports = { handler, definition };

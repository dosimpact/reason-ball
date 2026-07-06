// @ts-nocheck
'use strict';

const path = require('path');
const { fileExists, writeTextFile } = require('../lib/files');
const { ensureFeature, initializeWorkspace, relativeDocPath, setFeatureDocument } = require('../lib/state');
const { gradateTemplate } = require('../lib/templates');

async function handler(args, context) {
  const projectDir = args.projectDir || context.projectDir;
  const feature = args.feature;
  if (!projectDir) return { error: 'projectDir is required. Call pgv_state_init first or pass projectDir.' };
  if (!feature) return { error: 'feature is required' };

  context.projectDir = projectDir;
  await initializeWorkspace(projectDir);

  const planPath = path.join(projectDir, relativeDocPath('plan', feature));
  if (!await fileExists(planPath)) {
    return {
      error: `Plan document is missing for '${feature}'. Run apb-pgv plan ${feature} first.`,
      missingDocument: relativeDocPath('plan', feature)
    };
  }

  const docPath = relativeDocPath('gradate', feature);
  const created = await writeTextFile(path.join(projectDir, docPath), gradateTemplate(feature), { overwrite: false });
  await ensureFeature(projectDir, feature, 'gradate');
  await setFeatureDocument(projectDir, feature, 'gradate', docPath);

  return {
    feature,
    phase: 'gradate',
    created,
    document: docPath,
    nextCommand: `apb-pgv validate ${feature}`
  };
}

const definition = {
  name: 'pgv_state_pgv_gradate',
  description: 'Create a PGV gradate document, transition the feature to gradate, and update PGV state.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the project root directory. Optional after init.'
      },
      feature: {
        type: 'string',
        description: 'Feature name.'
      }
    },
    required: ['feature']
  }
};

module.exports = { handler, definition };

export {};

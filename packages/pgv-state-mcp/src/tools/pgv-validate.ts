// @ts-nocheck
'use strict';

const path = require('path');
const { fileExists, writeTextFile } = require('../lib/files');
const { ensureFeature, initializeWorkspace, relativeDocPath, setFeatureDocument } = require('../lib/state');
const { validateTemplate } = require('../lib/templates');

async function handler(args, context) {
  const projectDir = args.projectDir || context.projectDir;
  const feature = args.feature;
  if (!projectDir) return { error: 'projectDir is required. Call pgv_state_init first or pass projectDir.' };
  if (!feature) return { error: 'feature is required' };

  context.projectDir = projectDir;
  await initializeWorkspace(projectDir);

  const gradatePath = path.join(projectDir, relativeDocPath('gradate', feature));
  if (!await fileExists(gradatePath)) {
    return {
      error: `Gradate document is missing for '${feature}'. Run apb-pgv gradate ${feature} first.`,
      missingDocument: relativeDocPath('gradate', feature)
    };
  }

  const docPath = relativeDocPath('validate', feature);
  const created = await writeTextFile(path.join(projectDir, docPath), validateTemplate(feature), { overwrite: false });
  await ensureFeature(projectDir, feature, 'validate');
  await setFeatureDocument(projectDir, feature, 'validate', docPath);

  return {
    feature,
    phase: 'validate',
    created,
    document: docPath,
    nextCommand: null
  };
}

const definition = {
  name: 'pgv_state_pgv_validate',
  description: 'Create a PGV validate report, transition the feature to validate, and update PGV state.',
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

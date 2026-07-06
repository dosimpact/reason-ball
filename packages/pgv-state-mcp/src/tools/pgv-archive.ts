// @ts-nocheck
'use strict';

const path = require('path');
const { fileExists, moveFile } = require('../lib/files');
const {
  PHASES,
  archiveFeature,
  initializeWorkspace,
  readStatus,
  relativeArchiveDocPath,
  relativeDocPath
} = require('../lib/state');

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function getAvailableArchivePath(projectDir, feature, fileName) {
  let archivePath = relativeArchiveDocPath(feature, fileName);
  if (!await fileExists(path.join(projectDir, archivePath))) {
    return archivePath;
  }

  const parsed = path.parse(fileName);
  archivePath = relativeArchiveDocPath(feature, `${parsed.name}.${timestampSuffix()}${parsed.ext}`);
  return archivePath;
}

async function handler(args, context) {
  const projectDir = args.projectDir || context.projectDir;
  const feature = args.feature;
  if (!projectDir) return { error: 'projectDir is required. Call pgv_state_init first or pass projectDir.' };
  if (!feature) return { error: 'feature is required' };

  context.projectDir = projectDir;
  await initializeWorkspace(projectDir);

  const status = await readStatus(projectDir);
  const featureStatus = status.features[feature] || null;
  if (!featureStatus) {
    return { error: `Feature '${feature}' is not tracked. Run apb-pgv plan ${feature} first.` };
  }

  const archivedDocuments = {};
  const moved = [];
  const missing = [];

  for (const phase of PHASES) {
    const currentDocPath = (featureStatus.documents || {})[phase] || relativeDocPath(phase, feature);
    const absoluteDocPath = path.join(projectDir, currentDocPath);
    if (!await fileExists(absoluteDocPath)) {
      missing.push({ phase, document: currentDocPath });
      continue;
    }

    const archiveDocPath = await getAvailableArchivePath(projectDir, feature, path.basename(currentDocPath));
    await moveFile(absoluteDocPath, path.join(projectDir, archiveDocPath));
    archivedDocuments[phase] = archiveDocPath;
    moved.push({ phase, from: currentDocPath, to: archiveDocPath });
  }

  if (moved.length === 0) {
    return {
      error: `No phase documents were found to archive for '${feature}'.`,
      feature,
      missing
    };
  }

  await archiveFeature(projectDir, feature, archivedDocuments);

  return {
    feature,
    phase: 'archived',
    archived: true,
    moved,
    missing,
    documents: archivedDocuments
  };
}

const definition = {
  name: 'pgv_state_pgv_archive',
  description: 'Archive PGV plan, gradate, and validate documents for a feature and update PGV state.',
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

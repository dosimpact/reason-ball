// @ts-nocheck
'use strict';

const path = require('path');
const { ensureDir, fileExists, readJsonFile, writeJsonFile } = require('./files');

const DOCS_DIR = '.apb-workspace/docs';
const STATUS_FILE = '.apb-workspace/docs/.apb-status.json';
const PHASES = ['plan', 'gradate', 'validate'];

function getStatusPath(projectDir) {
  return path.join(projectDir, STATUS_FILE);
}

function getDocsDir(projectDir) {
  return path.join(projectDir, DOCS_DIR);
}

function getDefaultStatus() {
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    activeFeatures: [],
    primaryFeature: null,
    features: {},
    history: []
  };
}

async function initializeWorkspace(projectDir) {
  await ensureDir(path.join(projectDir, DOCS_DIR, '01-plan'));
  await ensureDir(path.join(projectDir, DOCS_DIR, '02-gradate'));
  await ensureDir(path.join(projectDir, DOCS_DIR, '03-validate'));
  await ensureDir(path.join(projectDir, DOCS_DIR, '99-archive'));

  const statusPath = getStatusPath(projectDir);
  const existed = await fileExists(statusPath);
  if (!existed) {
    await writeStatus(projectDir, getDefaultStatus());
  }

  return { statusPath, existed, status: await readStatus(projectDir) };
}

async function readStatus(projectDir) {
  const statusPath = getStatusPath(projectDir);
  if (!await fileExists(statusPath)) {
    return getDefaultStatus();
  }
  return readJsonFile(statusPath);
}

async function writeStatus(projectDir, status) {
  status.lastUpdated = new Date().toISOString();
  await writeJsonFile(getStatusPath(projectDir), status);
  return status;
}

async function ensureFeature(projectDir, feature, phase) {
  const status = await readStatus(projectDir);
  const existing = status.features[feature] || null;
  const now = new Date().toISOString();

  if (!existing) {
    status.features[feature] = {
      phase,
      status: phase,
      completedPhases: [],
      documents: {},
      createdAt: now,
      updatedAt: now
    };
    if (!status.activeFeatures.includes(feature)) {
      status.activeFeatures.push(feature);
    }
    if (!status.primaryFeature) {
      status.primaryFeature = feature;
    }
    status.history.push({ feature, to: phase, timestamp: now });
  } else {
    const previousPhase = existing.phase || null;
    existing.phase = phase;
    existing.status = phase;
    existing.updatedAt = now;
    if (previousPhase && previousPhase !== phase && !existing.completedPhases.includes(previousPhase)) {
      existing.completedPhases.push(previousPhase);
    }
    if (previousPhase !== phase) {
      status.history.push({ feature, from: previousPhase, to: phase, timestamp: now });
    }
  }

  return writeStatus(projectDir, status);
}

async function setFeatureDocument(projectDir, feature, phase, docPath) {
  const status = await readStatus(projectDir);
  if (!status.features[feature]) {
    await ensureFeature(projectDir, feature, phase);
    return setFeatureDocument(projectDir, feature, phase, docPath);
  }
  status.features[feature].documents[phase] = docPath;
  status.features[feature].updatedAt = new Date().toISOString();
  return writeStatus(projectDir, status);
}

async function archiveFeature(projectDir, feature, archivedDocuments) {
  const status = await readStatus(projectDir);
  const existing = status.features[feature] || null;
  const now = new Date().toISOString();

  if (!existing) {
    status.features[feature] = {
      phase: 'archived',
      status: 'archived',
      completedPhases: PHASES.slice(),
      documents: archivedDocuments,
      createdAt: now,
      updatedAt: now,
      archivedAt: now
    };
  } else {
    const previousPhase = existing.phase || null;
    existing.phase = 'archived';
    existing.status = 'archived';
    existing.completedPhases = Array.from(new Set([...(existing.completedPhases || []), ...PHASES]));
    existing.documents = { ...(existing.documents || {}), ...archivedDocuments };
    existing.updatedAt = now;
    existing.archivedAt = now;
    if (previousPhase !== 'archived') {
      status.history.push({ feature, from: previousPhase, to: 'archived', timestamp: now });
    }
  }

  status.activeFeatures = (status.activeFeatures || []).filter((activeFeature) => activeFeature !== feature);
  if (status.primaryFeature === feature) {
    status.primaryFeature = status.activeFeatures[0] || null;
  }

  return writeStatus(projectDir, status);
}

function getPhaseProgress(featureStatus) {
  return PHASES.map((phase) => {
    if (!featureStatus) return { phase, status: 'pending' };
    if (featureStatus.phase === phase) return { phase, status: 'active' };
    if ((featureStatus.completedPhases || []).includes(phase)) return { phase, status: 'done' };
    const activeIndex = PHASES.indexOf(featureStatus.phase);
    const phaseIndex = PHASES.indexOf(phase);
    return { phase, status: phaseIndex < activeIndex ? 'done' : 'pending' };
  });
}

function relativeDocPath(phase, feature) {
  const dir = phase === 'plan' ? '01-plan' : phase === 'gradate' ? '02-gradate' : '03-validate';
  return `${DOCS_DIR}/${dir}/${feature}.${phase}.md`;
}

function relativeArchiveDocPath(feature, fileName) {
  return `${DOCS_DIR}/99-archive/${feature}/${fileName}`;
}

module.exports = {
  DOCS_DIR,
  STATUS_FILE,
  PHASES,
  archiveFeature,
  ensureFeature,
  getDocsDir,
  getPhaseProgress,
  getStatusPath,
  initializeWorkspace,
  readStatus,
  relativeArchiveDocPath,
  relativeDocPath,
  setFeatureDocument,
  writeStatus
};

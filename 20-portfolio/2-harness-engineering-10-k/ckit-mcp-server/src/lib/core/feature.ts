// @ts-nocheck
'use strict';

const path = require('path');

const FEATURE_PATH_SKIP_PARTS = [
  'src',
  'lib',
  'app',
  'components',
  'pages',
  'api',
  'utils',
  'hooks',
  'styles',
  'public',
  'assets'
];

function extractFeatureName(filePath, projectDir) {
  const relative = path.relative(projectDir, filePath);
  const parts = relative.split(path.sep);

  for (const part of parts) {
    if (!FEATURE_PATH_SKIP_PARTS.includes(part) && !part.startsWith('.') && !part.includes('.')) {
      return part;
    }
  }

  const basename = path.basename(filePath, path.extname(filePath));
  if (basename && !FEATURE_PATH_SKIP_PARTS.includes(basename)) {
    return basename;
  }

  return null;
}

module.exports = { extractFeatureName, FEATURE_PATH_SKIP_PARTS };

export {};

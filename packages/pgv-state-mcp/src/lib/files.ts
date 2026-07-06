// @ts-nocheck
'use strict';

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

async function readJsonFile(filePath) {
  return JSON.parse(await fsPromises.readFile(filePath, 'utf-8'));
}

async function writeJsonFile(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function writeTextFile(filePath, text, options = {}) {
  await ensureDir(path.dirname(filePath));
  if (options.overwrite === false && await fileExists(filePath)) {
    return false;
  }
  await fsPromises.writeFile(filePath, text, 'utf-8');
  return true;
}

async function moveFile(sourcePath, targetPath) {
  await ensureDir(path.dirname(targetPath));
  await fsPromises.rename(sourcePath, targetPath);
}

module.exports = {
  ensureDir,
  fileExists,
  moveFile,
  readJsonFile,
  writeJsonFile,
  writeTextFile
};

export {};

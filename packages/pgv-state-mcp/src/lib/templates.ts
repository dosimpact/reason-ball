// @ts-nocheck
'use strict';

const fs = require('fs');
const path = require('path');

function renderTemplate(templateName, values) {
  const templatePath = path.join(__dirname, '..', 'template', `${templateName}.md`);
  const template = fs.readFileSync(templatePath, 'utf-8');
  return template.replace(/\{\{feature\}\}/g, values.feature);
}

function planTemplate(feature) {
  return renderTemplate('plan', { feature });
}

function gradateTemplate(feature) {
  return renderTemplate('gradate', { feature });
}

function validateTemplate(feature) {
  return renderTemplate('validate', { feature });
}

module.exports = {
  planTemplate,
  gradateTemplate,
  validateTemplate
};

export {};

// @ts-nocheck
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_MATRIX = {
  plan: 'plan.template.md',
  design: 'design.template.md',
  analysis: 'analysis.template.md',
  report: 'report.template.md',
  do: 'do.template.md'
};

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

/**
 * Select the appropriate template name based on phase.
 * @param {string} phase - PDCA phase
 * @returns {string} Template file name
 */
function selectTemplate(phase) {
  return TEMPLATE_MATRIX[phase] || 'plan.template.md';
}

/**
 * Get the raw template content.
 * @param {string} templateName
 * @returns {string}
 */
function getTemplateContent(templateName) {
  const templatePath = path.join(TEMPLATE_DIR, templateName);

  if (!fs.existsSync(templatePath)) {
    return `# Template: ${templateName}\n\n[Template not found]\n`;
  }

  return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Resolve template variables.
 * @param {string} content - Template content with ${VAR} placeholders
 * @param {object} vars - Variable map: { FEATURE, DATE, LEVEL, PROJECT }
 * @returns {string}
 */
function resolveTemplateVariables(content, vars) {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(pattern, value || '');
  }
  return result;
}

/**
 * Get list of all available templates.
 * @returns {string[]}
 */
function getTemplateList() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    return [];
  }

  return fs.readdirSync(TEMPLATE_DIR)
    .filter((fileName) => fileName.endsWith('.template.md'))
    .sort();
}

/**
 * Validate that a template has required sections.
 * @param {string} content
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTemplate(content) {
  const errors = [];
  if (!content || typeof content !== 'string') {
    return { valid: false, errors: ['Template content must be a non-empty string'] };
  }
  if (!content.startsWith('#')) {
    errors.push('Template should start with a markdown heading');
  }
  if (content.length < 50) {
    errors.push('Template content is too short');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  selectTemplate,
  getTemplateContent,
  resolveTemplateVariables,
  getTemplateList,
  validateTemplate
};

export {};

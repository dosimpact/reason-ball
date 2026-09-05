// @ts-nocheck
'use strict';

const templates = {
  plan: require('../template/plan.md'),
  gradate: require('../template/gradate.md'),
  validate: require('../template/validate.md')
};

function renderTemplate(templateName, values) {
  const template = templates[templateName];
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

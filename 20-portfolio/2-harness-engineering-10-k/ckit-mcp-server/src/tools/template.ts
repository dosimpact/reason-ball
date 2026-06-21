// @ts-nocheck
'use strict';

const { selectTemplate, getTemplateContent, resolveTemplateVariables, getTemplateList } = require('../lib/pdca/template');

/**
 * ckit_select_template - Template selection for PDCA documents.
 */
async function handler(args, context) {
  const phase = args.phase;
  if (!phase) return { error: 'phase is required' };

  const validPhases = ['plan', 'design', 'analysis', 'report', 'do'];
  if (!validPhases.includes(phase)) {
    return { error: `Invalid phase '${phase}'. Must be one of: ${validPhases.join(', ')}` };
  }

  const templateName = selectTemplate(phase);
  const templateContent = getTemplateContent(templateName);
  const allTemplates = getTemplateList();

  return {
    phase,
    templateName,
    template: templateContent,
    availableTemplates: allTemplates,
    guidance: `Use this template for the ${phase} phase. Replace \${FEATURE} and \${DATE} placeholders as needed.`
  };
}

const definition = {
  name: 'ckit_select_template',
  description: 'Select appropriate PDCA template based on phase.',
  inputSchema: {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        enum: ['plan', 'design', 'analysis', 'report', 'do'],
        description: 'PDCA phase'
      }
    },
    required: ['phase']
  }
};

module.exports = { handler, definition };

export {};

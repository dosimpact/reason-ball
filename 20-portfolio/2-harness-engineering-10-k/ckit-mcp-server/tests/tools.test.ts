// @ts-nocheck
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getToolDefinitions } = require('../src/tools');

/**
 * Expected tool names in the order they are registered.
 */
const EXPECTED_TOOLS = [
  'ckit_init',
  'ckit_get_status',
  'ckit_pre_write_check',
  'ckit_post_write',
  'ckit_complete_phase',
  'ckit_pdca_plan',
  'ckit_pdca_design',
  'ckit_pdca_analyze',
  'ckit_pdca_next',
  'ckit_analyze_prompt',
  'ckit_select_template',
  'ckit_memory_read',
  'ckit_memory_write'
];

describe('MCP Tool Definitions', () => {
  const tools = getToolDefinitions();

  it('should export exactly 13 tools', () => {
    assert.strictEqual(tools.length, 13, `Expected 13 tools but got ${tools.length}`);
  });

  it('should contain all expected tool names', () => {
    const names = tools.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      assert.ok(
        names.includes(expected),
        `Missing tool: ${expected}. Found: ${names.join(', ')}`
      );
    }
  });

  it('should have no duplicate tool names', () => {
    const names = tools.map(t => t.name);
    const unique = new Set(names);
    assert.strictEqual(
      unique.size,
      names.length,
      `Duplicate tool names found: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`
    );
  });

  // Individual tool definition tests
  for (const expectedName of EXPECTED_TOOLS) {
    describe(`Tool: ${expectedName}`, () => {
      const tool = tools.find(t => t.name === expectedName);

      it('should exist in tool definitions', () => {
        assert.ok(tool, `Tool ${expectedName} not found in definitions`);
      });

      it('should have a non-empty name', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        assert.strictEqual(typeof tool.name, 'string');
        assert.ok(tool.name.length > 0, 'Tool name must not be empty');
      });

      it('should have a non-empty description', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        assert.strictEqual(typeof tool.description, 'string');
        assert.ok(
          tool.description.length > 10,
          `Tool ${expectedName} description too short: "${tool.description}"`
        );
      });

      it('should have a valid inputSchema', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        assert.ok(tool.inputSchema, `Tool ${expectedName} missing inputSchema`);
        assert.strictEqual(
          typeof tool.inputSchema,
          'object',
          `Tool ${expectedName} inputSchema must be an object`
        );
      });

      it('should have inputSchema with type "object"', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        assert.strictEqual(
          tool.inputSchema.type,
          'object',
          `Tool ${expectedName} inputSchema.type must be "object"`
        );
      });

      it('should have inputSchema with properties object', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        assert.ok(
          tool.inputSchema.properties && typeof tool.inputSchema.properties === 'object',
          `Tool ${expectedName} inputSchema must have a properties object`
        );
      });

      it('should have inputSchema.required as an array if present', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        if (tool.inputSchema.required !== undefined) {
          assert.ok(
            Array.isArray(tool.inputSchema.required),
            `Tool ${expectedName} inputSchema.required must be an array`
          );
        }
      });

      it('should only list known properties in required', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        if (Array.isArray(tool.inputSchema.required)) {
          const propNames = Object.keys(tool.inputSchema.properties);
          for (const req of tool.inputSchema.required) {
            assert.ok(
              propNames.includes(req),
              `Tool ${expectedName} requires unknown property "${req}". ` +
              `Known: ${propNames.join(', ')}`
            );
          }
        }
      });

      it('should have string type for each property description', () => {
        assert.ok(tool, `Tool ${expectedName} not found`);
        for (const [propName, propDef] of Object.entries(tool.inputSchema.properties)) {
          if (propDef.description !== undefined) {
            assert.strictEqual(
              typeof propDef.description,
              'string',
              `Tool ${expectedName} property "${propName}" description must be a string`
            );
          }
        }
      });
    });
  }
});

describe('v1.0.0 Integration: New tool capabilities', () => {
  const tools = getToolDefinitions();

  it('ckit_init should have compactSummary capability (handler returns it)', () => {
    const initTool = tools.find(t => t.name === 'ckit_init');
    assert.ok(initTool, 'ckit_init tool should exist');
    assert.ok(initTool.inputSchema.properties.projectDir, 'Should have projectDir param');
  });

  it('ckit_get_status should have mode parameter for recovery', () => {
    const statusTool = tools.find(t => t.name === 'ckit_get_status');
    assert.ok(statusTool, 'ckit_get_status tool should exist');
    assert.ok(statusTool.inputSchema.properties.mode, 'Should have mode parameter');
    assert.deepStrictEqual(
      statusTool.inputSchema.properties.mode.enum,
      ['normal', 'recovery'],
      'mode enum should be [normal, recovery]'
    );
  });

  it('ckit_pdca_plan should have feature as required param', () => {
    const planTool = tools.find(t => t.name === 'ckit_pdca_plan');
    assert.ok(planTool, 'ckit_pdca_plan tool should exist');
    assert.ok(planTool.inputSchema.required.includes('feature'), 'feature should be required');
  });

  it('ckit_complete_phase should have feature and phase as required params', () => {
    const completeTool = tools.find(t => t.name === 'ckit_complete_phase');
    assert.ok(completeTool, 'ckit_complete_phase tool should exist');
    assert.ok(completeTool.inputSchema.required.includes('feature'), 'feature should be required');
    assert.ok(completeTool.inputSchema.required.includes('phase'), 'phase should be required');
  });
});

describe('Tool Definition Consistency', () => {
  const tools = getToolDefinitions();

  it('should have all tool names starting with "ckit_"', () => {
    for (const tool of tools) {
      assert.ok(
        tool.name.startsWith('ckit_'),
        `Tool "${tool.name}" does not follow naming convention (must start with "ckit_")`
      );
    }
  });

  it('should have descriptions shorter than 500 characters', () => {
    for (const tool of tools) {
      assert.ok(
        tool.description.length < 500,
        `Tool "${tool.name}" description is too long (${tool.description.length} chars)`
      );
    }
  });

  it('should have no tool with empty properties', () => {
    for (const tool of tools) {
      const propCount = Object.keys(tool.inputSchema.properties).length;
      assert.ok(
        propCount > 0,
        `Tool "${tool.name}" has zero properties in inputSchema`
      );
    }
  });
});

export {};

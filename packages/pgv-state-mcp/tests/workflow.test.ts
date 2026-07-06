// @ts-nocheck
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../src/server');

async function callTool(server, name, args) {
  const response = await server.handleRequest({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 100000),
    method: 'tools/call',
    params: { name, arguments: args }
  });
  assert.ifError(response.error);
  assert.ok(!response.result.isError, response.result.content[0].text);
  return JSON.parse(response.result.content[0].text);
}

describe('PGV workflow tools', () => {
  it('creates state and phase documents for plan -> gradate -> validate', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pgv-state-mcp-'));
    const server = createServer();

    const init = await callTool(server, 'pgv_state_init', { projectDir });
    assert.strictEqual(init.initialized, true);
    assert.strictEqual(init.created, true);

    const plan = await callTool(server, 'pgv_state_pgv_plan', { feature: 'sample-feature' });
    assert.strictEqual(plan.phase, 'plan');
    assert.strictEqual(plan.document, '.apb-workspace/docs/01-plan/sample-feature.plan.md');

    const gradate = await callTool(server, 'pgv_state_pgv_gradate', { feature: 'sample-feature' });
    assert.strictEqual(gradate.phase, 'gradate');

    const validate = await callTool(server, 'pgv_state_pgv_validate', { feature: 'sample-feature' });
    assert.strictEqual(validate.phase, 'validate');

    const status = await callTool(server, 'pgv_state_get_status', { feature: 'sample-feature' });
    assert.strictEqual(status.found, true);
    assert.strictEqual(status.status.phase, 'validate');
    assert.strictEqual(status.documents.validate, '.apb-workspace/docs/03-validate/sample-feature.validate.md');

    await fs.access(path.join(projectDir, '.apb-workspace/docs/.apb-status.json'));
    await fs.access(path.join(projectDir, '.apb-workspace/docs/01-plan/sample-feature.plan.md'));
    await fs.access(path.join(projectDir, '.apb-workspace/docs/02-gradate/sample-feature.gradate.md'));
    await fs.access(path.join(projectDir, '.apb-workspace/docs/03-validate/sample-feature.validate.md'));

    const archive = await callTool(server, 'pgv_state_pgv_archive', { feature: 'sample-feature' });
    assert.strictEqual(archive.phase, 'archived');
    assert.strictEqual(archive.archived, true);
    assert.deepStrictEqual(archive.moved.map((entry) => entry.phase), ['plan', 'gradate', 'validate']);
    assert.strictEqual(archive.documents.plan, '.apb-workspace/docs/99-archive/sample-feature/sample-feature.plan.md');
    assert.strictEqual(archive.documents.gradate, '.apb-workspace/docs/99-archive/sample-feature/sample-feature.gradate.md');
    assert.strictEqual(archive.documents.validate, '.apb-workspace/docs/99-archive/sample-feature/sample-feature.validate.md');

    await assert.rejects(
      fs.access(path.join(projectDir, '.apb-workspace/docs/01-plan/sample-feature.plan.md')),
      { code: 'ENOENT' }
    );
    await assert.rejects(
      fs.access(path.join(projectDir, '.apb-workspace/docs/02-gradate/sample-feature.gradate.md')),
      { code: 'ENOENT' }
    );
    await assert.rejects(
      fs.access(path.join(projectDir, '.apb-workspace/docs/03-validate/sample-feature.validate.md')),
      { code: 'ENOENT' }
    );
    await fs.access(path.join(projectDir, '.apb-workspace/docs/99-archive/sample-feature/sample-feature.plan.md'));
    await fs.access(path.join(projectDir, '.apb-workspace/docs/99-archive/sample-feature/sample-feature.gradate.md'));
    await fs.access(path.join(projectDir, '.apb-workspace/docs/99-archive/sample-feature/sample-feature.validate.md'));

    const archivedStatus = await callTool(server, 'pgv_state_get_status', { feature: 'sample-feature' });
    assert.strictEqual(archivedStatus.status.phase, 'archived');
    assert.strictEqual(archivedStatus.status.status, 'archived');
    assert.ok(archivedStatus.status.archivedAt);

    const allStatus = await callTool(server, 'pgv_state_get_status', {});
    assert.deepStrictEqual(allStatus.activeFeatures, []);
    assert.strictEqual(allStatus.primaryFeature, null);
  });

  it('does not overwrite an existing plan for a tracked feature', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pgv-state-mcp-'));
    const server = createServer();

    await callTool(server, 'pgv_state_init', { projectDir });
    await callTool(server, 'pgv_state_pgv_plan', { feature: 'existing-feature' });
    const second = await callTool(server, 'pgv_state_pgv_plan', { feature: 'existing-feature' });

    assert.strictEqual(second.created, false);
    assert.match(second.message, /not overwritten/);
  });
});

export {};
